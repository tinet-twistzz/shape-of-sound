import type { PatternParams } from '@/types/domain'
import type { PatternMapper } from '@/types/services'

const MIN_HZ = 80
const MAX_HZ = 2600
const LOG_SPAN = Math.log(MAX_HZ / MIN_HZ)
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
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
    const clamped = Math.min(MAX_HZ, Math.max(MIN_HZ, frequencyHz))
    const t = Math.log(clamped / MIN_HZ) / LOG_SPAN
    return patternAt(t * (MODES.length - 1), 1.5)
  },
  voiceFrequencyToPattern(frequencyHz) {
    const clamped = Math.min(VOICE_MAX_HZ, Math.max(VOICE_MIN_HZ, frequencyHz))
    // 幂曲线舒展低频端：正常说话（100–300Hz）覆盖中阶，情绪峰值（400–650Hz）解锁 (3,7)/(4,7)/(5,7)
    const t = Math.pow((clamped - VOICE_MIN_HZ) / (VOICE_MAX_HZ - VOICE_MIN_HZ), 0.7)
    return patternAt(t * (MODES.length - 1), 1.2)
  },
}