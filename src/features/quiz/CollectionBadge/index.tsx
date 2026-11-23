import { useEffect, useRef, useState } from 'react'

import { PatternThumbnail } from '@/components/sand/PatternThumbnail'
import { CollectionIcon, SoundExhibitIcon, SpeakerIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import type { SoundPreset } from '@/types/domain'

import styles from './CollectionBadge.module.css'

export interface CollectionBadgeProps {
  collected: SoundPreset[]
  total: number
  playingId?: string | null
  onPlay?: (preset: SoundPreset) => void
}

/** 角落图鉴徽章：点击展开已收集图案的小缩略图列表，支持点击复听对应采样 */
export function CollectionBadge({ collected, total, playingId, onPlay }: CollectionBadgeProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.badge}
        aria-expanded={open}
        aria-controls="quiz-collection-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <CollectionIcon size={14} />
        <span className={`mono ${styles.count}`} key={collected.length}>
          {copy.sections.quiz.collectionLabel} {collected.length} / {total}
        </span>
      </button>

      {open && (
        <div
          className={styles.panel}
          id="quiz-collection-panel"
          role="group"
          aria-label={copy.sections.quiz.collectedLabel}
        >
          <span className={`mono ${styles.panelTitle}`}>{copy.sections.quiz.collectedLabel}</span>
          {collected.length === 0 ? (
            <p className={`caption ${styles.empty}`}>{copy.sections.quiz.collectionEmpty}</p>
          ) : (
            <ul className={styles.list}>
              {collected.map((preset) => {
                const isPlaying = playingId === preset.id
                return (
                  <li key={preset.id}>
                    <button
                      type="button"
                      className={[styles.item, isPlaying && styles.itemPlaying]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={copy.sections.quiz.collectionReplayAria(preset.name)}
                      onClick={() => onPlay?.(preset)}
                    >
                      <PatternThumbnail pattern={preset.pattern} size={44} theme="gold" />
                      <span className={styles.itemBody}>
                        <span className={styles.itemName}>
                          <SoundExhibitIcon id={preset.id} size={14} className={styles.itemIcon} />
                          {preset.name}
                        </span>
                        <span className={`mono ${styles.itemCode}`}>{preset.patternName}</span>
                      </span>
                      <span className={styles.playCue} aria-hidden="true">
                        {isPlaying ? (
                          <span className={styles.eq}>
                            <span />
                            <span />
                            <span />
                          </span>
                        ) : (
                          <SpeakerIcon size={13} />
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
