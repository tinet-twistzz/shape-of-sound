import type { SoundPreset } from '@/types/domain'
import type { AudioEngine, ToneOptions } from '@/types/services'

const FADE_IN_S = 0.03
const MASTER_VOLUME = 0.75
const BASE_PEAK = 0.34

const CHORD_RATIOS: Record<NonNullable<ToneOptions['chord']>, number> = {
  solo: 1,
  octave: 2,
  fifth: 1.5,
  third: 1.25,
  vortex: Math.SQRT2,
}

const CHORD_LEVELS: Record<NonNullable<ToneOptions['chord']>, number> = {
  solo: 0,
  octave: 0.4,
  fifth: 0.45,
  third: 0.36,
  vortex: 0.42,
}

interface Voice {
  sources: AudioScheduledSourceNode[]
  gain: GainNode
  stopped: boolean
  partialGains?: GainNode[]
  filter?: BiquadFilterNode
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  // iOS Safari 与微信内置浏览器旧版本仅暴露 webkitAudioContext
  const safariWindow = window as Window & { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? safariWindow.webkitAudioContext ?? null
}

function decodeAudio(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // 回调形式兼容不支持 Promise 返回值的旧版 Safari / 微信内核
  return new Promise((resolve, reject) => {
    void ctx.decodeAudioData(data, resolve, reject)
  })
}

function holdParam(param: AudioParam, time: number) {
  // 旧版 Safari 无 cancelAndHoldAtTime：必须先读瞬时值再取消排程，否则参数跳变产生咔哒声
  const withHold = param as AudioParam & {
    cancelAndHoldAtTime?: (cancelTime: number) => AudioParam
  }
  if (typeof withHold.cancelAndHoldAtTime === 'function') {
    withHold.cancelAndHoldAtTime(time)
    return
  }
  const current = param.value
  param.cancelScheduledValues(time)
  param.setValueAtTime(current, time)
}

function createWebAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null
  let warmthFilter: BiquadFilterNode | null = null
  let masterGain: GainNode | null = null
  let safetyLimiter: DynamicsCompressorNode | null = null
  let muted = false
  let activeVoice: Voice | null = null
  let requestId = 0
  let lastToneTime = -Infinity
  let lastToneFreq = 0
  let lastToneTimbre = 0
  let lastToneChord: NonNullable<ToneOptions['chord']> = 'solo'

  const bufferCache = new Map<string, AudioBuffer>()
  const pendingLoads = new Map<string, Promise<AudioBuffer | null>>()

  function ensureContext(): AudioContext | null {
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch((error: unknown) => {
          console.warn('[WebAudioEngine] AudioContext resume 失败', error)
        })
      }
      return ctx
    }
    const Ctor = getAudioContextCtor()
    if (!Ctor) {
      console.warn('[WebAudioEngine] 当前浏览器不支持 Web Audio API')
      return null
    }
    try {
      ctx = new Ctor()
      warmthFilter = ctx.createBiquadFilter()
      warmthFilter.type = 'lowpass'
      warmthFilter.frequency.value = 5200
      warmthFilter.Q.value = 0.707
      masterGain = ctx.createGain()
      masterGain.gain.value = muted ? 0 : MASTER_VOLUME
      safetyLimiter = ctx.createDynamicsCompressor()
      safetyLimiter.threshold.value = -3
      safetyLimiter.knee.value = 6
      safetyLimiter.ratio.value = 12
      safetyLimiter.attack.value = 0.003
      safetyLimiter.release.value = 0.15
      warmthFilter.connect(masterGain)
      masterGain.connect(safetyLimiter)
      safetyLimiter.connect(ctx.destination)
      if (ctx.state === 'suspended') {
        ctx.resume().catch((error: unknown) => {
          console.warn('[WebAudioEngine] AudioContext resume 失败', error)
        })
      }
      return ctx
    } catch (error) {
      console.warn('[WebAudioEngine] AudioContext 创建失败', error)
      ctx = null
      warmthFilter = null
      masterGain = null
      safetyLimiter = null
      return null
    }
  }

  function stopActiveVoice() {
    const voice = activeVoice
    activeVoice = null
    if (!voice || !ctx || voice.stopped) return
    voice.stopped = true
    const now = ctx.currentTime
    holdParam(voice.gain.gain, now)
    voice.gain.gain.setTargetAtTime(0, now, 0.025)
    for (const source of voice.sources) {
      try {
        source.stop(now + 0.16)
      } catch {
        // 已自然结束的 source 重复 stop 会抛 InvalidStateError，忽略即可
      }
    }
  }

  function trackVoice(voice: Voice) {
    activeVoice = voice
    voice.sources[0].onended = () => {
      for (const source of voice.sources) source.disconnect()
      for (const partial of voice.partialGains ?? []) partial.disconnect()
      voice.filter?.disconnect()
      voice.gain.disconnect()
      if (activeVoice === voice) activeVoice = null
    }
  }

  function loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = bufferCache.get(url)
    if (cached) return Promise.resolve(cached)
    const pending = pendingLoads.get(url)
    if (pending) return pending

    const task = (async () => {
      if (!ctx) return null
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.arrayBuffer()
        const buffer = await decodeAudio(ctx, data)
        bufferCache.set(url, buffer)
        return buffer
      } catch (error) {
        console.warn(`[WebAudioEngine] 音频加载失败：${url}`, error)
        return null
      } finally {
        pendingLoads.delete(url)
      }
    })()
    pendingLoads.set(url, task)
    return task
  }

  function startBufferVoice(audioCtx: AudioContext, buffer: AudioBuffer) {
    if (!warmthFilter) return
    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    const gain = audioCtx.createGain()
    const now = audioCtx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + FADE_IN_S)
    source.connect(gain)
    gain.connect(warmthFilter)
    source.start(now)
    trackVoice({ sources: [source], gain, stopped: false })
  }

  function playTone(frequencyHz: number, options?: ToneOptions) {
    const timbre = Math.min(1, Math.max(-1, options?.timbre ?? 0))
    const chord = options?.chord ?? 'solo'
    // 滑杆 / 按钮连击会在同一帧重复触发同参数音，45ms 内忽略防止包络互相打断
    const nowMs = performance.now()
    if (
      nowMs - lastToneTime < 45 &&
      frequencyHz === lastToneFreq &&
      timbre === lastToneTimbre &&
      chord === lastToneChord
    ) {
      return
    }
    lastToneTime = nowMs
    lastToneFreq = frequencyHz
    lastToneTimbre = timbre
    lastToneChord = chord

    const audioCtx = ensureContext()
    if (!audioCtx || !warmthFilter) return
    requestId += 1
    stopActiveVoice()

    const now = audioCtx.currentTime
    // 等响度补偿：低频抬升、高频按幂律滚降，避免低音发虚 / 高音刺耳
    let peakGain = BASE_PEAK
    if (frequencyHz < 140) {
      peakGain *= 1.12
    } else if (frequencyHz > 550) {
      peakGain *= Math.pow(550 / frequencyHz, 0.48)
    }

    // 音色形态：温润端收敛泛音，清冽端放开高次泛音；无 options 的旧调用保持原比例
    const partialScale = options ? (timbre >= 0 ? 1 + 1.6 * timbre : 1 + 0.85 * timbre) : 1
    const freqT = Math.min(1, Math.max(0, (frequencyHz - 80) / (2400 - 80)))
    const secondLevel = frequencyHz * 2 < 4800 ? (0.16 + (0.03 - 0.16) * freqT) * partialScale : 0
    const sustainedThird = timbre > 0.15 && frequencyHz * 3 < 4800
    const thirdLevel = frequencyHz * 3 < 4800 ? (sustainedThird ? 0.04 + 0.1 * timbre : 0.05) : 0
    const fourthLevel = timbre > 0.5 && frequencyHz * 4 < 4800 ? 0.12 * (timbre - 0.5) : 0
    const chordFreq = frequencyHz * CHORD_RATIOS[chord]
    const chordLevel = chord !== 'solo' && chordFreq < 5200 ? CHORD_LEVELS[chord] : 0
    // 总增益归一化：泛音与和弦音越多，包络峰值越低，防止叠加削波
    peakGain /= 1 + secondLevel + thirdLevel + fourthLevel + chordLevel

    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.setTargetAtTime(peakGain, now, 0.012)
    gain.gain.setTargetAtTime(0, now + 0.045, 0.26)
    // 音色滤波只作用于本音色，不改动共享 warmthFilter，避免染色采样回放
    let voiceFilter: BiquadFilterNode | undefined
    if (options) {
      voiceFilter = audioCtx.createBiquadFilter()
      voiceFilter.type = 'lowpass'
      voiceFilter.Q.value = 0.707
      const brightness = timbre >= 0 ? 3 + 5 * timbre : 3 + 2.1 * timbre
      voiceFilter.frequency.value = Math.min(9000, Math.max(700, frequencyHz * brightness))
      gain.connect(voiceFilter)
      voiceFilter.connect(warmthFilter)
    } else {
      gain.connect(warmthFilter)
    }

    const sources: AudioScheduledSourceNode[] = []
    const partialGains: GainNode[] = []

    const fundamental = audioCtx.createOscillator()
    fundamental.type = 'sine'
    fundamental.frequency.value = frequencyHz
    fundamental.connect(gain)
    sources.push(fundamental)

    if (secondLevel > 0) {
      const secondGain = audioCtx.createGain()
      secondGain.gain.value = secondLevel
      const second = audioCtx.createOscillator()
      second.type = 'sine'
      second.frequency.value = frequencyHz * 2
      second.connect(secondGain)
      secondGain.connect(gain)
      sources.push(second)
      partialGains.push(secondGain)
    }

    if (thirdLevel > 0) {
      const thirdGain = audioCtx.createGain()
      if (sustainedThird) {
        thirdGain.gain.setValueAtTime(thirdLevel, now)
        thirdGain.gain.setTargetAtTime(thirdLevel * 0.4, now + 0.08, 0.3)
      } else {
        // 三倍频只做 20ms 瞬态，模拟轻敲音叉的清亮起音，避免持续泛音打架嗡鸣
        thirdGain.gain.setValueAtTime(0.05, now)
        thirdGain.gain.setTargetAtTime(0, now + 0.02, 0.05)
      }
      const third = audioCtx.createOscillator()
      third.type = 'sine'
      third.frequency.value = frequencyHz * 3
      third.connect(thirdGain)
      thirdGain.connect(gain)
      sources.push(third)
      partialGains.push(thirdGain)
    }

    if (fourthLevel > 0) {
      const fourthGain = audioCtx.createGain()
      fourthGain.gain.setValueAtTime(fourthLevel, now)
      fourthGain.gain.setTargetAtTime(0, now + 0.1, 0.22)
      const fourth = audioCtx.createOscillator()
      fourth.type = 'sine'
      fourth.frequency.value = frequencyHz * 4
      fourth.connect(fourthGain)
      fourthGain.connect(gain)
      sources.push(fourth)
      partialGains.push(fourthGain)
    }

    if (chordLevel > 0) {
      const chordGain = audioCtx.createGain()
      chordGain.gain.value = chordLevel
      const chordOsc = audioCtx.createOscillator()
      chordOsc.type = 'sine'
      chordOsc.frequency.value = chordFreq
      chordOsc.connect(chordGain)
      chordGain.connect(gain)
      sources.push(chordOsc)
      partialGains.push(chordGain)
    }

    for (const source of sources) {
      source.start(now)
      source.stop(now + 1.45)
    }
    trackVoice({ sources, gain, stopped: false, partialGains, filter: voiceFilter })
  }

  return {
    play(sound: SoundPreset) {
      const audioCtx = ensureContext()
      if (!audioCtx) return
      requestId += 1
      const currentRequest = requestId
      stopActiveVoice()

      if (!sound.audioUrl) {
        playTone(sound.frequencyHz)
        return
      }
      void loadBuffer(sound.audioUrl).then((buffer) => {
        // 加载期间用户可能已切换声音或静音停止，丢弃过期请求
        if (!buffer || currentRequest !== requestId || !ctx) return
        startBufferVoice(ctx, buffer)
      })
    },
    playTone,
    stop() {
      requestId += 1
      stopActiveVoice()
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted
      if (!ctx || !masterGain) return
      const now = ctx.currentTime
      holdParam(masterGain.gain, now)
      masterGain.gain.setTargetAtTime(nextMuted ? 0 : MASTER_VOLUME, now, 0.02)
    },
  }
}

export const webAudioEngine: AudioEngine = createWebAudioEngine()