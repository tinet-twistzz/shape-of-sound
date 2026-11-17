import { principleChapters } from '@/data/mock/principleChapters'
import { quizQuestions } from '@/data/mock/quizQuestions'
import { quizSoundPool } from '@/data/mock/quizSoundPool'
import { soundPresets } from '@/data/mock/soundPresets'
import type { DataSource } from '@/types/services'

const MOCK_LATENCY_MS = 300

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), MOCK_LATENCY_MS)
  })
}

export const mockDataSource: DataSource = {
  getSoundPresets: () => delay(soundPresets.map((preset) => ({ ...preset }))),
  getQuizSoundPool: () => delay(quizSoundPool.map((preset) => ({ ...preset }))),
  getQuizQuestions: () => delay(quizQuestions.map((question) => ({ ...question }))),
  getPrincipleChapters: () => delay(principleChapters.map((chapter) => ({ ...chapter }))),
}
