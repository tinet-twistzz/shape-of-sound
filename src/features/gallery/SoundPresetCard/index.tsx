import { Card } from '@/components/ui/Card'
import { SoundExhibitIcon } from '@/components/ui/icons'
import type { SoundPreset } from '@/types/domain'

import { PITCH_META } from '../pitchMeta'

import styles from './SoundPresetCard.module.css'

export interface SoundPresetCardProps {
  preset: SoundPreset
  selected: boolean
  onSelect: () => void
}

/** 声音展品卡片：细线展品图标 + 名称 + 音高等级小标，选中态金色光晕 */
export function SoundPresetCard({ preset, selected, onSelect }: SoundPresetCardProps) {
  const pitch = PITCH_META[preset.pitchLevel]
  return (
    <Card selected={selected} onSelect={onSelect} className={styles.card}>
      <span className={styles.iconPlate} aria-hidden="true">
        <SoundExhibitIcon id={preset.id} />
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{preset.name}</span>
        <span className={`${styles.pitch} ${styles[preset.pitchLevel]}`}>
          <span className={styles.pitchDot} aria-hidden="true" />
          {pitch.label}
        </span>
      </span>
    </Card>
  )
}
