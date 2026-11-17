import { copy } from '@/content/copy'

/** 滑杆频率范围：与声音展品库的最低 / 最高频率对齐 */
export const FREQ_MIN = 50
export const FREQ_MAX = 3200
export const FREQ_STEP = 10

const tones = copy.sections.studio.frequencyTones

/** 频率 → 听感描述（不向观众暴露 Hz 数字） */
export function describeFrequency(frequencyHz: number): string {
  if (frequencyHz < 150) return tones.thunder
  if (frequencyHz < 350) return tones.whale
  if (frequencyHz < 550) return tones.bell
  if (frequencyHz < 800) return tones.violin
  if (frequencyHz < 1200) return tones.mosquito
  if (frequencyHz < 2400) return tones.whistle
  return tones.bird
}

/** 频率 → 沙盘振动能量：音越高，沙纹越亮越细 */
export function energyForFrequency(frequencyHz: number): number {
  const t = (frequencyHz - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)
  return 0.45 + 0.5 * Math.min(1, Math.max(0, t))
}

/** 滑杆模式下的预览波形：由当前频率合成一条静态正弦 */
export function previewWaveform(frequencyHz: number, size = 128): Float32Array {
  const cycles = 2 + ((frequencyHz - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * 10
  const wave = new Float32Array(size)
  for (let i = 0; i < size; i += 1) {
    wave[i] = 0.55 * Math.sin((i / size) * Math.PI * 2 * cycles)
  }
  return wave
}
