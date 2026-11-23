import { copy } from '@/content/copy'
import {
  EIGEN_MODES,
  SLIDER_MAX_HZ,
  SLIDER_MIN_HZ,
  SLIDER_STEPS,
  freqToSliderPos,
  getResonanceInfo,
  sliderPosToFreq,
} from '@/services/real/chladniPatternMapper'

export {
  EIGEN_MODES,
  SLIDER_MAX_HZ,
  SLIDER_MIN_HZ,
  SLIDER_STEPS,
  freqToSliderPos,
  getResonanceInfo,
  sliderPosToFreq,
}

/** 滑杆频率范围：与对数克拉尼模态映射器对齐 */
export const FREQ_MIN = SLIDER_MIN_HZ
export const FREQ_MAX = SLIDER_MAX_HZ

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

/** 频率 → 沙盘振动能量：按对数行程均匀舒展，音越高沙纹越亮越细 */
export function energyForFrequency(frequencyHz: number): number {
  const t = freqToSliderPos(frequencyHz) / SLIDER_STEPS
  return 0.45 + 0.5 * Math.min(1, Math.max(0, t))
}

/** 滑杆模式下的预览波形：按对数调音位置合成静态正弦 */
export function previewWaveform(frequencyHz: number, size = 128): Float32Array {
  const t = freqToSliderPos(frequencyHz) / SLIDER_STEPS
  const cycles = 2 + t * 10
  const wave = new Float32Array(size)
  for (let i = 0; i < size; i += 1) {
    wave[i] = 0.55 * Math.sin((i / size) * Math.PI * 2 * cycles)
  }
  return wave
}
