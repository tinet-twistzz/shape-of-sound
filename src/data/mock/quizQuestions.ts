import type { QuizQuestion } from '@/types/domain'

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    targetPattern: { n: 1, m: 5 },
    targetPatternName: '双横阔格',
    optionSoundIds: ['quiz-didgeridoo', 'quiz-musical-saw', 'quiz-celesta'],
    answerSoundId: 'quiz-didgeridoo',
    hint: '看这几道横跨整块沙盘的宽大线条，说明背后是极其低沉浑厚的声音哦。',
    explanation:
      '揭晓：这是来自澳洲的【迪吉里杜管共鸣】！超低频空气柱驻波波长极长，只能画出错落宽阔的线条。',
  },
  {
    id: 'q2',
    targetPattern: { n: 4, m: 7 },
    targetPatternName: '繁星蝶阵',
    optionSoundIds: ['quiz-didgeridoo', 'quiz-bach-harpsichord', 'quiz-celesta'],
    answerSoundId: 'quiz-celesta',
    hint: '花纹中心和四角都织出了精致细节，去找那个最清脆明亮、像水晶敲击一样的高音。',
    explanation:
      '揭晓：这是柴可夫斯基《糖梅仙子》里的【钢片琴】！清脆高频的金属敲击音把沙粒雕琢得繁密精细。',
  },
  {
    id: 'q3',
    targetPattern: { n: 2, m: 4 },
    targetPatternName: '四叶方阵',
    optionSoundIds: ['quiz-theremin-bass', 'quiz-harp-harmonic', 'quiz-theremin-high'],
    answerSoundId: 'quiz-theremin-bass',
    hint: '三个选项里有一个听起来低沉平稳、像来自太空的电子低吟，试听对比一下高低。',
    explanation:
      '揭晓：这是 1920 年代发明的隔空乐器【特雷门低音】！手不碰琴身，靠电场变化就能震出对称方阵。',
  },
  {
    id: 'q4',
    targetPattern: { n: 4, m: 5 },
    targetPatternName: '织锦花篮',
    optionSoundIds: ['quiz-theremin-bass', 'quiz-musical-saw', 'quiz-theremin-high'],
    answerSoundId: 'quiz-musical-saw',
    hint: '既没有第一个那么低沉，也没有第三个那么尖锐高亢，找中间那个如泣如诉的弓弦金属声。',
    explanation:
      '揭晓：这是【琴弓拉响的锯片】！用小提琴弓拉动弯曲钢锯发声，和克拉尼用琴弓拉黄铜板是完全一样的物理原理。',
  },
  {
    id: 'q5',
    targetPattern: { n: 4, m: 6 },
    targetPatternName: '重檐棋格',
    optionSoundIds: ['quiz-bach-harpsichord', 'quiz-harp-harmonic', 'quiz-theremin-high'],
    answerSoundId: 'quiz-harp-harmonic',
    hint: '留意音调介于中等偏高、清澄如水的那一个拨弦泛音。',
    explanation:
      '揭晓：这是【竖琴波节泛音】！乐手轻按琴弦正中不动点拨弦，纯化出的高次谐波在沙盘上织出了整齐棋格。',
  },
  {
    id: 'q6',
    targetPattern: { n: 6, m: 7 },
    targetPatternName: '星云密网',
    optionSoundIds: ['quiz-bach-harpsichord', 'quiz-harp-harmonic', 'quiz-theremin-high'],
    answerSoundId: 'quiz-theremin-high',
    hint: '这是全关最细密、线条最多的一幅！选出音高最高、最锐利明亮的那个声音。',
    explanation:
      '通关！这是【特雷门高音咏叹】，极高频率让整张沙盘布满密密麻麻的节点星网。',
  },
]
