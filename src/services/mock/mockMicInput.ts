import type { MicInput, MicListener } from '@/types/services'

const FRAME_INTERVAL_MS = 50
const WAVEFORM_SIZE = 128

// TODO: 替换为 getUserMedia + AnalyserNode + 音高检测（FFT / 自相关）
export function createMockMicInput(): MicInput {
  const listeners = new Set<MicListener>()
  let timer: number | null = null
  let tick = 0

  const pushFrame = () => {
    tick += 1
    const t = tick * FRAME_INTERVAL_MS
    const pitchHz = 220 + 60 * Math.sin(t / 1200)
    const volume = 0.35 + 0.25 * Math.sin(t / 800)
    const waveform = new Float32Array(WAVEFORM_SIZE)
    for (let i = 0; i < WAVEFORM_SIZE; i += 1) {
      waveform[i] = volume * Math.sin((i / WAVEFORM_SIZE) * Math.PI * 8 + t / 200)
    }
    const frame = { pitchHz, volume, waveform }
    listeners.forEach((listener) => listener(frame))
  }

  return {
    start() {
      if (timer === null) {
        console.log('[MockMicInput] start')
        timer = window.setInterval(pushFrame, FRAME_INTERVAL_MS)
      }
      return Promise.resolve()
    },
    stop() {
      if (timer !== null) {
        console.log('[MockMicInput] stop')
        window.clearInterval(timer)
        timer = null
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
