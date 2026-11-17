import type { CSSProperties } from 'react'

import { copy } from '@/content/copy'
import type { SoundPreset } from '@/types/domain'

import { SoundPresetCard } from '../SoundPresetCard'

import styles from './SoundPresetGrid.module.css'

export interface SoundPresetGridProps {
  presets: readonly SoundPreset[]
  selectedId: string | null
  onSelect: (preset: SoundPreset) => void
}

/** 声音展品网格：宽屏 2×4，手机 2 列 */
export function SoundPresetGrid({ presets, selectedId, onSelect }: SoundPresetGridProps) {
  return (
    <div className={styles.grid} role="group" aria-label={copy.sections.gallery.gridLabel}>
      {presets.map((preset, index) => (
        <div
          key={preset.id}
          className={styles.cell}
          style={{ '--stagger': `${index * 55}ms` } as CSSProperties}
        >
          <SoundPresetCard
            preset={preset}
            selected={preset.id === selectedId}
            onSelect={() => onSelect(preset)}
          />
        </div>
      ))}
    </div>
  )
}
