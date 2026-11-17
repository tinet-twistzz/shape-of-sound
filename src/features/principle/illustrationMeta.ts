import { copy } from '@/content/copy'

export type IllustrationTone = 'gold' | 'cyan' | 'violet'

export interface IllustrationMeta {
  label: string
  tone: IllustrationTone
}

const ILLUSTRATION_TONES: Record<string, IllustrationTone> = {
  'air-waves': 'cyan',
  'nodal-lines': 'gold',
  'pattern-density': 'violet',
  applications: 'cyan',
  'home-experiment': 'gold',
}

export function getIllustrationMeta(key: string): IllustrationMeta {
  return {
    label: copy.principle.illustrationLabels[key] ?? key,
    tone: ILLUSTRATION_TONES[key] ?? 'gold',
  }
}
