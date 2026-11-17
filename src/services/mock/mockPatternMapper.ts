import { soundPresets } from '@/data/mock/soundPresets'
import type { PatternMapper } from '@/types/services'

// TODO: 替换为基于真实模态表的频率 → (n, m) 映射
export const mockPatternMapper: PatternMapper = {
  frequencyToPattern(frequencyHz) {
    let nearest = soundPresets[0]
    for (const preset of soundPresets) {
      if (
        Math.abs(preset.frequencyHz - frequencyHz) < Math.abs(nearest.frequencyHz - frequencyHz)
      ) {
        nearest = preset
      }
    }
    return { ...nearest.pattern }
  },
}
