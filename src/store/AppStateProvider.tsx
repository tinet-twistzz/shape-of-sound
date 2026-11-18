import { useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'

import { useServices } from '@/services/serviceContext'
import { AppActionsContext, AppStateContext } from '@/store/appStateContext'
import type { AppActions, AppState } from '@/store/appStateContext'
import type { InputMode, MicStatus, ParticleTheme, QuizQuestion, SectionId } from '@/types/domain'

const initialState: AppState = {
  currentSection: 'hero',
  muted: false,
  selectedSoundId: null,
  quiz: { index: 0, selectedSoundId: null, result: null, collectedIds: [] },
  studio: { inputMode: 'slider', frequencyHz: 440, theme: 'gold', author: '', micStatus: 'idle' },
  principle: { open: false, chapterId: null },
  galleryVersion: 0,
}

type Action =
  | { type: 'SELECT_SOUND'; soundId: string | null }
  | { type: 'ANSWER_QUIZ'; soundId: string; correct: boolean }
  | { type: 'NEXT_QUESTION' }
  | { type: 'RETRY_QUIZ' }
  | { type: 'RESET_QUIZ' }
  | { type: 'SET_INPUT_MODE'; inputMode: InputMode }
  | { type: 'SET_FREQUENCY'; frequencyHz: number }
  | { type: 'SET_THEME'; theme: ParticleTheme }
  | { type: 'SET_AUTHOR'; author: string }
  | { type: 'SET_MIC_STATUS'; micStatus: MicStatus }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'OPEN_PRINCIPLE'; chapterId: string | null }
  | { type: 'CLOSE_PRINCIPLE' }
  | { type: 'SET_CURRENT_SECTION'; section: SectionId }
  | { type: 'REFRESH_GALLERY' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SELECT_SOUND':
      return { ...state, selectedSoundId: action.soundId }
    case 'ANSWER_QUIZ': {
      const collectedIds =
        action.correct && !state.quiz.collectedIds.includes(action.soundId)
          ? [...state.quiz.collectedIds, action.soundId]
          : state.quiz.collectedIds
      return {
        ...state,
        quiz: {
          ...state.quiz,
          selectedSoundId: action.soundId,
          result: action.correct ? 'correct' : 'wrong',
          collectedIds,
        },
      }
    }
    case 'NEXT_QUESTION':
      return {
        ...state,
        quiz: { ...state.quiz, index: state.quiz.index + 1, selectedSoundId: null, result: null },
      }
    case 'RETRY_QUIZ':
      return { ...state, quiz: { ...state.quiz, selectedSoundId: null, result: null } }
    case 'RESET_QUIZ':
      return { ...state, quiz: { index: 0, selectedSoundId: null, result: null, collectedIds: [] } }
    case 'SET_INPUT_MODE':
      return { ...state, studio: { ...state.studio, inputMode: action.inputMode } }
    case 'SET_FREQUENCY':
      return { ...state, studio: { ...state.studio, frequencyHz: action.frequencyHz } }
    case 'SET_THEME':
      return { ...state, studio: { ...state.studio, theme: action.theme } }
    case 'SET_AUTHOR':
      return { ...state, studio: { ...state.studio, author: action.author } }
    case 'SET_MIC_STATUS':
      return { ...state, studio: { ...state.studio, micStatus: action.micStatus } }
    case 'TOGGLE_MUTE':
      return { ...state, muted: !state.muted }
    case 'OPEN_PRINCIPLE':
      return {
        ...state,
        principle: { open: true, chapterId: action.chapterId ?? state.principle.chapterId },
      }
    case 'CLOSE_PRINCIPLE':
      return { ...state, principle: { ...state.principle, open: false } }
    case 'SET_CURRENT_SECTION':
      return state.currentSection === action.section
        ? state
        : { ...state, currentSection: action.section }
    case 'REFRESH_GALLERY':
      return { ...state, galleryVersion: state.galleryVersion + 1 }
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { audioEngine, quizService } = useServices()

  useEffect(() => {
    audioEngine.setMuted(state.muted)
  }, [audioEngine, state.muted])

  const actions = useMemo<AppActions>(
    () => ({
      selectSound: (soundId) => dispatch({ type: 'SELECT_SOUND', soundId }),
      answerQuiz: (question: QuizQuestion, soundId: string) =>
        dispatch({ type: 'ANSWER_QUIZ', soundId, correct: quizService.check(question, soundId) }),
      nextQuestion: () => dispatch({ type: 'NEXT_QUESTION' }),
      retryQuiz: () => dispatch({ type: 'RETRY_QUIZ' }),
      resetQuiz: () => dispatch({ type: 'RESET_QUIZ' }),
      setInputMode: (inputMode) => dispatch({ type: 'SET_INPUT_MODE', inputMode }),
      setFrequency: (frequencyHz) => dispatch({ type: 'SET_FREQUENCY', frequencyHz }),
      setTheme: (theme) => dispatch({ type: 'SET_THEME', theme }),
      setAuthor: (author) => dispatch({ type: 'SET_AUTHOR', author }),
      setMicStatus: (micStatus) => dispatch({ type: 'SET_MIC_STATUS', micStatus }),
      toggleMute: () => dispatch({ type: 'TOGGLE_MUTE' }),
      openPrinciple: (chapterId) =>
        dispatch({ type: 'OPEN_PRINCIPLE', chapterId: chapterId ?? null }),
      closePrinciple: () => dispatch({ type: 'CLOSE_PRINCIPLE' }),
      setCurrentSection: (section) => dispatch({ type: 'SET_CURRENT_SECTION', section }),
      refreshGallery: () => dispatch({ type: 'REFRESH_GALLERY' }),
    }),
    [quizService],
  )

  return (
    <AppStateContext.Provider value={state}>
      <AppActionsContext.Provider value={actions}>{children}</AppActionsContext.Provider>
    </AppStateContext.Provider>
  )
}
