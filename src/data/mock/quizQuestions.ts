import type { QuizQuestion } from '@/types/domain'

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    targetPattern: { n: 1, m: 2 },
    targetPatternName: '图案 A',
    optionSoundIds: ['heartbeat', 'church-bell', 'bird-call'],
    answerSoundId: 'heartbeat',
    hint: '它很低、很慢，三个声音里最沉的那一个。',
  },
  {
    id: 'q2',
    targetPattern: { n: 2, m: 3 },
    targetPatternName: '图案 C',
    optionSoundIds: ['whale-song', 'violin', 'whistle'],
    answerSoundId: 'whale-song',
    hint: '悠长又低回的歌声，来自很深很深的地方。',
  },
  {
    id: 'q3',
    targetPattern: { n: 3, m: 4 },
    targetPatternName: '图案 E',
    optionSoundIds: ['bass-drum', 'violin', 'mosquito'],
    answerSoundId: 'violin',
    hint: '不粗也不尖，是中间那档明亮又温柔的声音。',
  },
  {
    id: 'q4',
    targetPattern: { n: 2, m: 5 },
    targetPatternName: '图案 F',
    optionSoundIds: ['violin', 'mosquito', 'whistle'],
    answerSoundId: 'mosquito',
    hint: '三个声音都不低，但它是里面最闷、最缠人的那一个。',
  },
  {
    id: 'q5',
    targetPattern: { n: 5, m: 7 },
    targetPatternName: '图案 H',
    optionSoundIds: ['mosquito', 'whistle', 'bird-call'],
    answerSoundId: 'bird-call',
    hint: '花纹最密的一题：找三个高音里冲得最高的那个。',
  },
]
