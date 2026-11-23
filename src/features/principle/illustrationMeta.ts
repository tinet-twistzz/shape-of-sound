import { copy } from '@/content/copy'
import type { ParticleTheme, PatternParams } from '@/types/domain'

export type IllustrationTone = 'gold' | 'cyan' | 'violet'

export interface IllustrationPlate {
  pattern: PatternParams
  theme: ParticleTheme
  tag: string
}

export interface IllustrationMeta {
  label: string
  caption: string
  tone: IllustrationTone
  plates: readonly IllustrationPlate[]
}

const tags = copy.principle.illustrationTags

const ILLUSTRATION_SPECS: Record<
  string,
  { tone: IllustrationTone; plates: readonly IllustrationPlate[] }
> = {
  'air-waves': {
    tone: 'cyan',
    plates: [
      { pattern: { n: 1, m: 2, a: 1, b: -1 }, theme: 'glacier', tag: tags.lowWave },
      { pattern: { n: 2, m: 3, a: 1, b: -1 }, theme: 'gold', tag: tags.midWave },
    ],
  },
  'nodal-lines': {
    tone: 'gold',
    plates: [{ pattern: { n: 2, m: 4, a: 1, b: -1 }, theme: 'gold', tag: tags.nodal }],
  },
  'pattern-density': {
    tone: 'violet',
    plates: [
      { pattern: { n: 1, m: 2, a: 1, b: -1 }, theme: 'glacier', tag: tags.lowPetal },
      { pattern: { n: 5, m: 7, a: 1, b: -1 }, theme: 'neon', tag: tags.highLace },
    ],
  },
  applications: {
    tone: 'cyan',
    plates: [
      {
        pattern: { n: 3, m: 2, a: 1, b: 0, plateShape: 'circle' },
        theme: 'glacier',
        tag: tags.circlePlate,
      },
      {
        pattern: { n: 3, m: 4, a: 1, b: -1, plateShape: 'hexagon' },
        theme: 'gold',
        tag: tags.hexPlate,
      },
    ],
  },
  'home-experiment': {
    tone: 'gold',
    plates: [
      { pattern: { n: 2, m: 3, a: 1, b: -1 }, theme: 'gold', tag: tags.soloMode },
      {
        pattern: { n: 2, m: 3, a: 1, b: -1, secondary: { n: 3, m: 5, weight: 0.45 } },
        theme: 'neon',
        tag: tags.chordMode,
      },
    ],
  },
}

export function getIllustrationMeta(key: string): IllustrationMeta {
  const spec = ILLUSTRATION_SPECS[key] ?? ILLUSTRATION_SPECS['nodal-lines']
  return {
    label: copy.principle.illustrationLabels[key] ?? key,
    caption: copy.principle.illustrationCaptions[key] ?? '',
    tone: spec.tone,
    plates: spec.plates,
  }
}
