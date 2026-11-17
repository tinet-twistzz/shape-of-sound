import type { PatternParams } from '@/types/domain'
import type { PatternMapper } from '@/types/services'

const MIN_HZ = 80
const MAX_HZ = 2600
const LOG_SPAN = Math.log(MAX_HZ / MIN_HZ)

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

export const chladniPatternMapper: PatternMapper = {
  frequencyToPattern(frequencyHz) {
    const clamped = Math.min(MAX_HZ, Math.max(MIN_HZ, frequencyHz))
    const t = Math.log(clamped / MIN_HZ) / LOG_SPAN
    const index = Math.round(t * (MODES.length - 1))
    return { ...MODES[index] }
  },
}