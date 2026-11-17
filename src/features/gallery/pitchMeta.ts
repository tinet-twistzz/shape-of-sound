import type { TagTone } from '@/components/ui/Tag'
import { copy } from '@/content/copy'
import type { PitchLevel } from '@/types/domain'

export interface PitchMeta {
  label: string
  tone: TagTone
  /** 沙盘振动能量：音越高，沙纹越亮越细 */
  energy: number
}

export const PITCH_META: Record<PitchLevel, PitchMeta> = {
  low: { label: copy.sections.gallery.pitchLabels.low, tone: 'cyan', energy: 0.5 },
  mid: { label: copy.sections.gallery.pitchLabels.mid, tone: 'gold', energy: 0.7 },
  high: { label: copy.sections.gallery.pitchLabels.high, tone: 'violet', energy: 0.9 },
}
