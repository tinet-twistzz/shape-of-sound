export const TIMBRE_MIN = -1
export const TIMBRE_MAX = 1
export const TIMBRE_STEP = 0.05
/** 与扫频映射器的耦合比摆幅一致：timbre ±1 → b ∓1.25 */
export const TIMBRE_B_SPAN = 1.25
/** 缺省落在清冽侧 b = -1，即经典克拉尼星芒 */
export const DEFAULT_TIMBRE = 0.8

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function timbreToB(timbre: number): number {
  const clamped = Math.min(TIMBRE_MAX, Math.max(TIMBRE_MIN, timbre))
  return round2(-TIMBRE_B_SPAN * clamped)
}