import type { MicFrame, MicInput, MicListener } from '@/types/services'

const FFT_SIZE = 2048
const WAVEFORM_SIZE = 128
const SILENCE_RMS = 0.015
const VOLUME_GAIN = 4
const MIN_PITCH_HZ = 80
const MAX_PITCH_HZ = 2000
// 归一化自相关峰值低于该值视为非周期信号（噪声 / 辅音），不输出基频
const PITCH_CLARITY = 0.5
const MEDIAN_WINDOW = 5
const SMOOTH_ALPHA = 0.3
const BRIGHTNESS_CUTOFF_HZ = 2000

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  // iOS Safari 与微信内置浏览器旧版本仅暴露 webkitAudioContext
  const safariWindow = window as Window & { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? safariWindow.webkitAudioContext ?? null
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  const size = samples.length
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_PITCH_HZ))
  const maxLag = Math.min(size - 2, Math.floor(sampleRate / MIN_PITCH_HZ))
  if (maxLag <= minLag) return null

  // 多算左右各一个 lag，供局部极大值判定与抛物线插值使用
  const corr = new Float32Array(maxLag + 2)
  for (let lag = minLag - 1; lag <= maxLag + 1; lag += 1) {
    let sum = 0
    const count = size - lag
    for (let i = 0; i < count; i += 1) {
      sum += samples[i] * samples[i + lag]
    }
    corr[lag] = sum / count
  }

  let energy = 0
  for (let i = 0; i < size; i += 1) {
    energy += samples[i] * samples[i]
  }
  energy /= size
  if (energy <= 0) return null

  // 只取真正的局部极大值：排除从 lag 0 延续的下降段（低频时会被误判为高频峰）
  let bestLag = -1
  let bestValue = 0
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const isPeak = corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1]
    if (isPeak && corr[lag] > bestValue) {
      bestValue = corr[lag]
      bestLag = lag
    }
  }
  if (bestLag < 0 || bestValue / energy < PITCH_CLARITY) return null

  // 优先取接近最高相关度的最小 lag，避免把倍周期误判为基频（低八度跳变）
  let chosen = bestLag
  for (let lag = minLag; lag < bestLag; lag += 1) {
    const isPeak = corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1]
    if (isPeak && corr[lag] >= bestValue * 0.9) {
      chosen = lag
      break
    }
  }

  // 抛物线插值细化到亚采样点，减轻低频段的量化误差
  let refined = chosen
  const x1 = corr[chosen - 1]
  const x2 = corr[chosen]
  const x3 = corr[chosen + 1]
  const a = (x1 + x3 - 2 * x2) / 2
  if (a !== 0) {
    refined = chosen - (x3 - x1) / (4 * a)
  }
  const pitchHz = sampleRate / refined
  if (pitchHz < MIN_PITCH_HZ || pitchHz > MAX_PITCH_HZ) return null
  return pitchHz
}

function computeBrightness(freqData: Uint8Array, sampleRate: number): number {
  const binHz = sampleRate / 2 / freqData.length
  const cutoffBin = Math.max(1, Math.floor(BRIGHTNESS_CUTOFF_HZ / binHz))
  let low = 0
  let high = 0
  for (let i = 0; i < freqData.length; i += 1) {
    const magnitude = freqData[i] / 255
    const e = magnitude * magnitude
    if (i >= cutoffBin) {
      high += e
    } else {
      low += e
    }
  }
  const total = low + high
  return total > 0 ? high / total : 0
}

export function createWebMicInput(): MicInput {
  const listeners = new Set<MicListener>()
  let ctx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let stream: MediaStream | null = null
  let rafId: number | null = null
  // stop() 递增使仍在等待授权的 start() 失效，避免迟到的流泄漏
  let generation = 0
  let startPromise: Promise<void> | null = null
  const pitchHistory: number[] = []
  let smoothedPitch: number | null = null

  function resetPitch() {
    pitchHistory.length = 0
    smoothedPitch = null
  }

  function releaseStream(mediaStream: MediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
  }

  async function doStart(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('[WebMicInput] 当前浏览器不支持 getUserMedia')
    }
    const Ctor = getAudioContextCtor()
    if (!Ctor) {
      throw new Error('[WebMicInput] 当前浏览器不支持 Web Audio API')
    }

    const currentGeneration = generation
    // 授权拒绝时原始 DOMException（NotAllowedError）直接透传给调用方
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    })
    if (currentGeneration !== generation) {
      releaseStream(mediaStream)
      return
    }

    let createdCtx: AudioContext | null = null
    try {
      const audioCtx = new Ctor()
      createdCtx = audioCtx
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }
      const analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = FFT_SIZE
      const sourceNode = audioCtx.createMediaStreamSource(mediaStream)
      // 不连接 destination：分析无需回放，也避免扬声器回授
      sourceNode.connect(analyserNode)

      const timeData = new Float32Array(analyserNode.fftSize)
      const freqData = new Uint8Array(analyserNode.frequencyBinCount)
      const stride = Math.floor(timeData.length / WAVEFORM_SIZE)

      const tick = () => {
        analyserNode.getFloatTimeDomainData(timeData)
        analyserNode.getByteFrequencyData(freqData)

        let sumSquares = 0
        for (let i = 0; i < timeData.length; i += 1) {
          sumSquares += timeData[i] * timeData[i]
        }
        const rms = Math.sqrt(sumSquares / timeData.length)
        const volume = Math.min(1, rms * VOLUME_GAIN)

        // 每帧新建数组：订阅方直接 setState(waveform)，复用引用会被 React 跳过渲染
        const waveform = new Float32Array(WAVEFORM_SIZE)
        for (let i = 0; i < WAVEFORM_SIZE; i += 1) {
          waveform[i] = timeData[i * stride]
        }

        let pitchHz: number | null = null
        if (rms > SILENCE_RMS) {
          const raw = detectPitch(timeData, audioCtx.sampleRate)
          if (raw !== null) {
            pitchHistory.push(raw)
            if (pitchHistory.length > MEDIAN_WINDOW) pitchHistory.shift()
            const med = median(pitchHistory)
            smoothedPitch =
              smoothedPitch === null ? med : smoothedPitch + SMOOTH_ALPHA * (med - smoothedPitch)
            pitchHz = smoothedPitch
          }
        } else {
          resetPitch()
        }

        const frame: MicFrame = {
          pitchHz,
          volume,
          waveform,
          brightness: computeBrightness(freqData, audioCtx.sampleRate),
        }
        listeners.forEach((listener) => listener(frame))
        rafId = requestAnimationFrame(tick)
      }

      ctx = audioCtx
      analyser = analyserNode
      source = sourceNode
      stream = mediaStream
      resetPitch()
      rafId = requestAnimationFrame(tick)
    } catch (error) {
      releaseStream(mediaStream)
      if (createdCtx && createdCtx.state !== 'closed') {
        await createdCtx.close().catch(() => undefined)
      }
      throw error
    }
  }

  return {
    start() {
      if (ctx) return Promise.resolve()
      if (!startPromise) {
        startPromise = doStart().finally(() => {
          startPromise = null
        })
      }
      return startPromise
    },
    stop() {
      generation += 1
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      source?.disconnect()
      analyser?.disconnect()
      if (stream) {
        releaseStream(stream)
      }
      if (ctx && ctx.state !== 'closed') {
        ctx.close().catch((error: unknown) => {
          console.warn('[WebMicInput] AudioContext 关闭失败', error)
        })
      }
      ctx = null
      analyser = null
      source = null
      stream = null
      resetPitch()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const webMicInput: MicInput = createWebMicInput()