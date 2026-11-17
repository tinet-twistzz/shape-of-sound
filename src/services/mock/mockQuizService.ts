import type { QuizService } from '@/types/services'

// TODO: 如需判分逻辑（容错、部分得分）在此扩展
export const mockQuizService: QuizService = {
  check(question, soundId) {
    return soundId === question.answerSoundId
  },
}
