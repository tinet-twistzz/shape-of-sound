import type { PatternParams } from '@/types/domain'
import type { PatternMapper } from '@/types/services'

export const SLIDER_MIN_HZ = 80
export const SLIDER_MAX_HZ = 2600
export const SLIDER_STEPS = 1000
const LOG_SPAN = Math.log(SLIDER_MAX_HZ / SLIDER_MIN_HZ)
const VOICE_MIN_HZ = 85
const VOICE_MAX_HZ = 650

/** 按模态复杂度（n+m 升序，同阶按 n*m 升序）排列，保证 n !== m */
const MODES: PatternParams[] = [
  { n: 1, m: 2 },
  { n: 1, m: 3 },
  { n: 1, m: 4 },
  { n: 2, m: 3 },
  { n: 1, m: 5 },
  { n: 2, m: 4 },
  { n: 2, m: 5 },
  { n: 3, m: 4 },
  { n: 3, m: 5 },
  { n: 4, m: 5 },
  { n: 3, m: 7 },
  { n: 4, m: 6 },
  { n: 4, m: 7 },
  { n: 5, m: 7 },
  { n: 6, m: 7 },
]

export interface EigenmodeMark {
  index: number
  n: number
  m: number
  centerHz: number
  /** 归一化滑杆位置 [0, 1000] */
  sliderPos: number
}

export const EIGEN_MODES: readonly EigenmodeMark[] = MODES.map((mode, index) => {
  const t = index / (MODES.length - 1)
  return {
    index,
    n: mode.n,
    m: mode.m,
    centerHz: Math.round(SLIDER_MIN_HZ * Math.exp(t * LOG_SPAN)),
    sliderPos: Math.round(t * SLIDER_STEPS),
  }
})

export interface ResonanceInfo {
  index: number
  n: number
  m: number
  locked: boolean
  snapHz: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 频率 (Hz) → 对数均匀滑杆位置 [0, 1000] */
export function freqToSliderPos(frequencyHz: number): number {
  const clamped = Math.min(SLIDER_MAX_HZ, Math.max(SLIDER_MIN_HZ, frequencyHz))
  const t = Math.log(clamped / SLIDER_MIN_HZ) / LOG_SPAN
  return Math.round(clamp01(t) * SLIDER_STEPS)
}

/** 对数滑杆位置 [0, 1000] → 频率 (Hz)，靠近本征态中心自动轻磁吸 */
export function sliderPosToFreq(pos: number, snap = true): number {
  const clampedPos = Math.min(SLIDER_STEPS, Math.max(0, pos))
  if (snap) {
    for (const mark of EIGEN_MODES) {
      if (Math.abs(clampedPos - mark.sliderPos) <= 13) {
        return mark.centerHz
      }
    }
  }
  const t = clampedPos / SLIDER_STEPS
  return Math.round(SLIDER_MIN_HZ * Math.exp(t * LOG_SPAN))
}

/** 查询给定频率对应的最近本征态与共振锁定状态 */
export function getResonanceInfo(frequencyHz: number): ResonanceInfo {
  const clamped = Math.min(SLIDER_MAX_HZ, Math.max(SLIDER_MIN_HZ, frequencyHz))
  const t = Math.log(clamped / SLIDER_MIN_HZ) / LOG_SPAN
  const pos = t * (MODES.length - 1)
  const near = Math.min(MODES.length - 1, Math.max(0, Math.round(pos)))
  const distance = Math.abs(pos - near)
  const mark = EIGEN_MODES[near]
  return {
    index: near,
    n: mark.n,
    m: mark.m,
    locked: distance < 0.04,
    snapHz: mark.centerHz,
  }
}

/** 已知模态 (n, m) 反查工坊对应的本征中心频率（未命中则回退 440Hz） */
export function modeToCenterHz(n: number, m: number, fallbackHz = 440): number {
  const exact = EIGEN_MODES.find((item) => item.n === n && item.m === m)
  if (exact) return exact.centerHz
  const swapped = EIGEN_MODES.find((item) => item.n === m && item.m === n)
  return swapped ? swapped.centerHz : fallbackHz
}

/**
 * 连续模态位置 → 图案：主模态取最近本征态，偏离中心时向相邻本征态
 * 轻量 secondary 过渡（避免阶跃跳变）；耦合比 b 随扫频位置正负摆动，
 * b > 0 呈闭合花岛 / 圆环，b < 0 呈星芒斜十字。
 */
function patternAt(pos: number, bCycles: number): PatternParams {
  const clamped = Math.min(MODES.length - 1, Math.max(0, pos))
  const i0 = Math.min(Math.floor(clamped), MODES.length - 2)
  const frac = clamped - i0
  const near = frac < 0.5 ? i0 : i0 + 1
  const far = frac < 0.5 ? i0 + 1 : i0
  const t = clamped / (MODES.length - 1)
  const b = round2(1.25 * Math.sin(Math.PI * (2 * bCycles * t - 0.5)))
  const pattern: PatternParams = { ...MODES[near], a: 1, b }
  const distance = Math.min(frac, 1 - frac)
  const weight = round2(clamp01(distance * 1.8) * 0.45)
  if (weight >= 0.05) {
    pattern.secondary = { ...MODES[far], weight }
  }
  return pattern
}

/** 频谱质心（0–1）→ 耦合比 b 的完整正负区间 [-1.4, +1.4]，人声核心区铺满量程 */
export function centroidToB(centroid: number): number {
  return round2(-1.4 + 2.8 * clamp01((centroid - 0.05) / 0.5))
}

export const chladniPatternMapper: PatternMapper = {
  frequencyToPattern(frequencyHz) {
    const clamped = Math.min(SLIDER_MAX_HZ, Math.max(SLIDER_MIN_HZ, frequencyHz))
    const t = Math.log(clamped / SLIDER_MIN_HZ) / LOG_SPAN
    return patternAt(t * (MODES.length - 1), 1.5)
  },
  voiceFrequencyToPattern(frequencyHz) {
    const clamped = Math.min(VOICE_MAX_HZ, Math.max(VOICE_MIN_HZ, frequencyHz))
    // 幂曲线舒展低频端：正常说话（100–300Hz）覆盖中阶，情绪峰值（400–650Hz）解锁 (3,7)/(4,7)/(5,7)
    const t = Math.pow((clamped - VOICE_MIN_HZ) / (VOICE_MAX_HZ - VOICE_MIN_HZ), 0.7)
    return patternAt(t * (MODES.length - 1), 1.2)
  },
}
