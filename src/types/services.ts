import type { Artwork, PatternParams, PrincipleChapter, QuizQuestion, SoundPreset } from './domain'

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

export interface Services {
  dataSource: DataSource
  audioEngine: AudioEngine
  micInput: MicInput
  quizService: QuizService
  patternMapper: PatternMapper
  artworkExporter: ArtworkExporter
}
