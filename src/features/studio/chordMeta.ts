import type { PatternParams, ResonanceChord } from '@/types/domain'

export const CHORD_ORDER: ResonanceChord[] = ['solo', 'octave', 'fifth', 'third', 'vortex']

const CHORD_SPECS: Record<
  ResonanceChord,
  { ratio: number; weight?: number; bOffset?: number; twist?: number }
> = {
  solo: { ratio: 1 },
  octave: { ratio: 2, weight: 0.38 },
  fifth: { ratio: 1.5, weight: 0.45 },
  third: { ratio: 1.25, weight: 0.32, bOffset: 0.18 },
  vortex: { ratio: Math.SQRT2, twist: 0.65 },
}

/** 大三度档的微弱正相偏移：把耦合比向同相圆岛侧轻推 */
export function chordBOffset(chord: ResonanceChord): number {
  return CHORD_SPECS[chord].bOffset ?? 0
}

/** 按和弦比例派生高阶协和副模态；solo 与 vortex 不叠加 secondary */
export function chordSecondary(
  n: number,
  m: number,
  chord: ResonanceChord,
): PatternParams['secondary'] {
  const spec = CHORD_SPECS[chord]
  if (spec.weight === undefined) return undefined
  const n2 = Math.max(1, Math.round(n * spec.ratio))
  let m2 = Math.max(1, Math.round(m * spec.ratio))
  if (m2 === n2) m2 += 1
  return { n: n2, m: m2, weight: spec.weight }
}

export function chordTwist(chord: ResonanceChord): number {
  return CHORD_SPECS[chord].twist ?? 0
}