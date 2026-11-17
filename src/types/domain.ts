export type PitchLevel = 'low' | 'mid' | 'high'

export type ParticleTheme = 'gold' | 'glacier' | 'neon'

export type InputMode = 'slider' | 'mic'

export type MicStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported'

export type SectionId = 'hero' | 'gallery' | 'quiz' | 'studio'

export interface PatternParams {
  n: number
  m: number
  a?: number
  b?: number
}

export interface SoundPreset {
  id: string
  name: string
  subtitle?: string
  emoji: string
  description: string
  pitchLevel: PitchLevel
  frequencyHz: number
  audioUrl?: string
  attribution?: string
  pattern: PatternParams
  patternName: string
}

export interface QuizQuestion {
  id: string
  targetPattern: PatternParams
  targetPatternName: string
  optionSoundIds: string[]
  answerSoundId: string
  hint: string
  explanation?: string
}

export interface Artwork {
  id: string
  pattern: PatternParams
  theme: ParticleTheme
  author: string
  source: InputMode
  frequencyHz: number
  createdAt: number
}

export interface PrincipleChapter {
  id: string
  title: string
  summary: string
  body: string[]
  expertNote?: string
  illustrationKey: string
  relatedSection?: SectionId
}
