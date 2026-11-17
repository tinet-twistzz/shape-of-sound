import type { SoundPreset } from '@/types/domain'
import type { AudioEngine } from '@/types/services'

const FADE_IN_S = 0.03
const FADE_OUT_S = 0.12
const MASTER_VOLUME = 0.8
const MUTE_RAMP_S = 0.03

const TONE_ATTACK_S = 0.04
const TONE_DECAY_S = 0.18
const TONE_SUSTAIN_LEVEL = 0.55
const TONE_SUSTAIN_S = 0.8
const TONE_RELEASE_S = 0.35
const TONE_OVERTONE_RATIO = 1.5
const TONE_OVERTONE_LEVEL = 0.22

interface Voice {
  sources: AudioScheduledSourceNode[]
  gain: GainNode
  stopped: boolean
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

function createWebAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let muted = false
  let activeVoice: Voice | null = null
  let requestId = 0

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
      masterGain = ctx.createGain()
      masterGain.gain.value = muted ? 0 : MASTER_VOLUME
      masterGain.connect(ctx.destination)
      if (ctx.state === 'suspended') {
        ctx.resume().catch((error: unknown) => {
          console.warn('[WebAudioEngine] AudioContext resume 失败', error)
        })
      }
      return ctx
    } catch (error) {
      console.warn('[WebAudioEngine] AudioContext 创建失败', error)
      ctx = null
      masterGain = null
      return null
    }
  }

  function stopActiveVoice() {
    const voice = activeVoice
    activeVoice = null
    if (!voice || !ctx || voice.stopped) return
    voice.stopped = true
    const now = ctx.currentTime
    const param = voice.gain.gain
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(0, now + FADE_OUT_S)
    for (const source of voice.sources) {
      try {
        source.stop(now + FADE_OUT_S + 0.02)
      } catch {
        // 已自然结束的 source 重复 stop 会抛 InvalidStateError，忽略即可
      }
    }
  }

  function trackVoice(voice: Voice) {
    activeVoice = voice
    voice.sources[0].onended = () => {
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
    if (!masterGain) return
    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    const gain = audioCtx.createGain()
    const now = audioCtx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + FADE_IN_S)
    source.connect(gain)
    gain.connect(masterGain)
    source.start(now)
    trackVoice({ sources: [source], gain, stopped: false })
  }

  function playTone(frequencyHz: number) {
    const audioCtx = ensureContext()
    if (!audioCtx || !masterGain) return
    requestId += 1
    stopActiveVoice()

    const now = audioCtx.currentTime
    const attackEnd = now + TONE_ATTACK_S
    const decayEnd = attackEnd + TONE_DECAY_S
    const releaseStart = decayEnd + TONE_SUSTAIN_S
    const end = releaseStart + TONE_RELEASE_S

    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, attackEnd)
    gain.gain.linearRampToValueAtTime(TONE_SUSTAIN_LEVEL, decayEnd)
    gain.gain.setValueAtTime(TONE_SUSTAIN_LEVEL, releaseStart)
    gain.gain.linearRampToValueAtTime(0, end)
    gain.connect(masterGain)

    const fundamental = audioCtx.createOscillator()
    fundamental.type = 'sine'
    fundamental.frequency.value = frequencyHz
    fundamental.connect(gain)

    const overtoneGain = audioCtx.createGain()
    overtoneGain.gain.value = TONE_OVERTONE_LEVEL
    const overtone = audioCtx.createOscillator()
    overtone.type = 'sine'
    overtone.frequency.value = frequencyHz * TONE_OVERTONE_RATIO
    overtone.connect(overtoneGain)
    overtoneGain.connect(gain)

    fundamental.start(now)
    overtone.start(now)
    fundamental.stop(end + 0.02)
    overtone.stop(end + 0.02)
    trackVoice({ sources: [fundamental, overtone], gain, stopped: false })
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
      const param = masterGain.gain
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(nextMuted ? 0 : MASTER_VOLUME, now + MUTE_RAMP_S)
    },
  }
}

export const webAudioEngine: AudioEngine = createWebAudioEngine()