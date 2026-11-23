import type { SoundPreset } from '@/types/domain'

/**
 * HALL 02 · 寻声猜形专用音频池：7 件独立声学/乐器名作（不与 HALL 01 画廊重样）
 * 音频均位于 public/sounds/quiz-*.m4a
 */
export const quizSoundPool: SoundPreset[] = [
  {
    id: 'quiz-didgeridoo',
    name: '迪吉里杜管共鸣',
    subtitle: '澳洲千年空气柱驻波',
    emoji: '🪵',
    description: '澳洲最古老的共鸣管乐器，吹奏者靠口腔共鸣在空心木管里建立超低沉的空气柱驻波。',
    pitchLevel: 'low',
    frequencyHz: 75,
    audioUrl: '/sounds/quiz-didgeridoo.m4a',
    attribution: 'Wikimedia Commons · Cassa342 (CC BY-SA 4.0)',
    pattern: { n: 1, m: 5 },
    patternName: '双横阔格',
  },
  {
    id: 'quiz-theremin-bass',
    name: '特雷门低音',
    subtitle: '1920 隔空电场乐器',
    emoji: '📡',
    description:
      '世界最早的电子乐器之一，不接触琴身、仅靠双手靠近天线改变电容即可发出低沉纯正的声波。',
    pitchLevel: 'low',
    frequencyHz: 135,
    audioUrl: '/sounds/quiz-theremin-bass.m4a',
    attribution: 'Wikimedia Commons · Effebit (CC BY-SA 3.0)',
    pattern: { n: 2, m: 4 },
    patternName: '四叶方阵',
  },
  {
    id: 'quiz-bach-harpsichord',
    name: '巴赫·羽管键琴',
    subtitle: 'Lauterwasser 水波实验经典曲目',
    emoji: '🎹',
    description:
      '巴赫《哥德堡变奏曲》选段。水声摄影师 Lauterwasser 曾反复用巴赫的复调音色在水面拍出对称几何。',
    pitchLevel: 'mid',
    frequencyHz: 330,
    audioUrl: '/sounds/quiz-bach-harpsichord.m4a',
    attribution: 'Wikimedia Commons · Bach Aria Harpsichord (Public Domain)',
    pattern: { n: 3, m: 5 },
    patternName: '双线星阵',
  },
  {
    id: 'quiz-musical-saw',
    name: '琴弓拉响的锯片',
    subtitle: '与克拉尼同原理的金属片发声',
    emoji: '🪚',
    description:
      '用小提琴弓直接拉奏弯曲钢锯，让整片金属薄板产生驻波歌唱——这正是克拉尼 1787 年实验的“兄弟乐器”。',
    pitchLevel: 'mid',
    frequencyHz: 520,
    audioUrl: '/sounds/quiz-musical-saw.m4a',
    attribution: 'Wikimedia Commons · Pijnack (CC BY-SA 3.0)',
    pattern: { n: 4, m: 5 },
    patternName: '织锦花篮',
  },
  {
    id: 'quiz-harp-harmonic',
    name: '竖琴波节泛音',
    subtitle: '轻触琴弦不动点激出的清音',
    emoji: '🎶',
    description: '手指轻按竖琴弦正中的“波节不动点”再拨弦，抑制低音基频，只留下纯净清透的高阶泛音。',
    pitchLevel: 'mid',
    frequencyHz: 880,
    audioUrl: '/sounds/quiz-harp-harmonic.m4a',
    attribution: 'Wikimedia Commons · Daniel Musiklexikon (Public Domain)',
    pattern: { n: 4, m: 6 },
    patternName: '重檐棋格',
  },
  {
    id: 'quiz-celesta',
    name: '糖梅仙子钢片琴',
    subtitle: '锤击金属片的晶莹高频',
    emoji: '🧚',
    description:
      '柴可夫斯基名曲里的钢片琴音色。小毛毡锤敲击精密金属片，释放出如冰晶般通透的高频谐波。',
    pitchLevel: 'high',
    frequencyHz: 1560,
    audioUrl: '/sounds/quiz-celesta.m4a',
    attribution: 'Wikimedia Commons · Sugar Plum Fairy Celesta (Public Domain)',
    pattern: { n: 4, m: 7 },
    patternName: '繁星蝶阵',
  },
  {
    id: 'quiz-theremin-high',
    name: '特雷门高音咏叹',
    subtitle: '近乎纯正弦波的高频声线',
    emoji: '⚡',
    description:
      '隔空操控的高音电子滑音，波形极为接近纯净正弦波，极高的震动频率把沙盘绣成最繁密的星网。',
    pitchLevel: 'high',
    frequencyHz: 2280,
    audioUrl: '/sounds/quiz-theremin-high.m4a',
    attribution: 'Wikimedia Commons · Effebit (Public Domain)',
    pattern: { n: 6, m: 7 },
    patternName: '星云密网',
  },
]
