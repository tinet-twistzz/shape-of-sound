export type PitchLevel = 'low' | 'mid' | 'high'

export type ParticleTheme = 'gold' | 'glacier' | 'neon'

export type InputMode = 'slider' | 'mic'

export type MicStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported'

export type SectionId = 'hero' | 'gallery' | 'quiz' | 'studio'

export type PlateShape = 'square' | 'circle'

/** 长声音压缩画法：'exposure' 多重曝光叠压，'rings' 声音年轮 */
export type CompressionMode = 'exposure' | 'rings'

export interface PatternParams {
  n: number
  m: number
  a?: number
  b?: number
  plateShape?: PlateShape
  /** 语气起伏明显时叠加的第二层花纹 */
  secondary?: { n: number; m: number; weight: number }
  compressionMode?: CompressionMode
  /** 长声音按时间压缩抽样后的声纹序列（最多 24 片），weight 为该时刻的响度权重 0–1 */
  timelineSlices?: Array<{ n: number; m: number; a: number; b: number; weight: number }>
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
