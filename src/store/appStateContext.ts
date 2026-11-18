import { createContext, useContext } from 'react'

import type { InputMode, MicStatus, ParticleTheme, QuizQuestion, SectionId } from '@/types/domain'

export type QuizResult = 'correct' | 'wrong'

interface QuizState {
  index: number
  selectedSoundId: string | null
  result: QuizResult | null
  collectedIds: string[]
}

interface StudioState {
  inputMode: InputMode
  frequencyHz: number
  theme: ParticleTheme
  author: string
  micStatus: MicStatus
}

interface PrincipleState {
  open: boolean
  chapterId: string | null
}

export interface AppState {
  currentSection: SectionId
  muted: boolean
  selectedSoundId: string | null
  quiz: QuizState
  studio: StudioState
  principle: PrincipleState
  /** 展厅刷新版本号：工坊发布/收藏后自增，驱动艺术展厅重新拉取 */
  galleryVersion: number
}

export interface AppActions {
  selectSound(soundId: string | null): void
  answerQuiz(question: QuizQuestion, soundId: string): void
  nextQuestion(): void
  retryQuiz(): void
  resetQuiz(): void
  setInputMode(inputMode: InputMode): void
  setFrequency(frequencyHz: number): void
  setTheme(theme: ParticleTheme): void
  setAuthor(author: string): void
  setMicStatus(micStatus: MicStatus): void
  toggleMute(): void
  openPrinciple(chapterId?: string): void
  closePrinciple(): void
  setCurrentSection(section: SectionId): void
  refreshGallery(): void
}

export const AppStateContext = createContext<AppState | null>(null)
export const AppActionsContext = createContext<AppActions | null>(null)

export function useAppState(): AppState {
  const state = useContext(AppStateContext)
  if (!state) {
    throw new Error('useAppState must be used within an AppStateProvider')
  }
  return state
}

export function useAppActions(): AppActions {
  const actions = useContext(AppActionsContext)
  if (!actions) {
    throw new Error('useAppActions must be used within an AppStateProvider')
  }
  return actions
}
