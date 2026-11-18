import type {
  Artwork,
  InputMode,
  ParticleTheme,
  PatternParams,
  PrincipleChapter,
  QuizQuestion,
  ReplayMeta,
  SoundPreset,
} from './domain'

export interface DataSource {
  getSoundPresets(): Promise<SoundPreset[]>
  getQuizSoundPool(): Promise<SoundPreset[]>
  getQuizQuestions(): Promise<QuizQuestion[]>
  getPrincipleChapters(): Promise<PrincipleChapter[]>
}

export interface AudioEngine {
  play(sound: SoundPreset): void
  playTone(frequencyHz: number): void
  stop(): void
  setMuted(muted: boolean): void
}

export interface MicFrame {
  pitchHz: number | null
  volume: number
  waveform: Float32Array
  // 0–1，高频能量占比（音色明亮度）；可选以兼容未提供该字段的数据源
  brightness?: number
}

export type MicListener = (frame: MicFrame) => void

export interface MicInput {
  start(): Promise<void>
  stop(): void
  subscribe(listener: MicListener): () => void
}

export interface QuizService {
  check(question: QuizQuestion, soundId: string): boolean
}

export interface PatternMapper {
  frequencyToPattern(frequencyHz: number): PatternParams
}

export interface ArtworkExporter {
  export(artwork: Artwork, snapshot: Blob | null): Promise<Blob | null>
}

export interface ExhibitionArtwork {
  id: string
  title: string
  author: string
  theme: ParticleTheme
  source: InputMode
  frequencyHz: number
  pattern: PatternParams
  replayMeta: ReplayMeta
  createdAt: number
  imageUrl: string
}

export interface ExhibitionDetail extends ExhibitionArtwork {
  stateUrl: string
}

export interface PublishInput {
  title: string
  author: string
  theme: ParticleTheme
  source: InputMode
  frequencyHz: number
  pattern: PatternParams
  replayMeta: ReplayMeta
}

export interface GalleryPage {
  items: ExhibitionArtwork[]
  hasMore: boolean
  nextOffset: number | null
}

export interface GalleryService {
  list(offset: number): Promise<GalleryPage>
  detail(id: string): Promise<ExhibitionDetail>
  /** 创建 → 上传快照与粒子状态 → 校验完成；失败抛 GalleryError，不自动重试 */
  publish(input: PublishInput, image: Blob, state: ArrayBuffer): Promise<{ id: string }>
}

export interface Services {
  dataSource: DataSource
  audioEngine: AudioEngine
  micInput: MicInput
  quizService: QuizService
  patternMapper: PatternMapper
  artworkExporter: ArtworkExporter
  galleryService: GalleryService
}
