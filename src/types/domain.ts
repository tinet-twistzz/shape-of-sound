export type PitchLevel = 'low' | 'mid' | 'high'

export type ParticleTheme = 'gold' | 'glacier' | 'neon' | 'voice'

/** 显影材质：矿物细沙 / 声流液银 / 织金磁丝 / 极光孢子，与色泽正交组合 */
export type ParticleMedium = 'sand' | 'mercury' | 'filings' | 'spores'

export type InputMode = 'slider' | 'mic'

export type MicStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported'

export type SectionId = 'hero' | 'gallery' | 'quiz' | 'studio' | 'exhibition'

export type PlateShape = 'square' | 'circle' | 'hexagon' | 'triangle'

/** 长声音压缩画法：'exposure' 多重曝光叠压，'rings' 声音年轮 */
export type CompressionMode = 'exposure' | 'rings'

/** 共鸣和弦档位：独奏 / 纯八度 / 纯五度 / 大三度 / 奇异拍频（√2 失谐涡旋） */
export type ResonanceChord = 'solo' | 'octave' | 'fifth' | 'third' | 'vortex'

export interface PatternParams {
  n: number
  m: number
  a?: number
  b?: number
  plateShape?: PlateShape
  /** 显影材质，缺省 'sand'，保证旧作品与题库兼容 */
  medium?: ParticleMedium
  /** 语气起伏明显时叠加的第二层花纹 */
  secondary?: { n: number; m: number; weight: number }
  /** 反对称扭转度 [-1, 1]：0 为纯偶函数镜像驻波，非 0 混入奇函数项形成风车 / 涡旋节线 */
  twist?: number
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
  title?: string
  pattern: PatternParams
  theme: ParticleTheme
  author: string
  source: InputMode
  frequencyHz: number
  createdAt: number
}

/** 高保真重放所需的仿真参数；count 为导出时的实际粒数，frequencyHz 随 state 一起入库 */
export interface ReplayMeta {
  density: number
  energy: number
  activeColorBand: 0 | 1 | 2 | 3
  count: number
  frequencyHz: number
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
