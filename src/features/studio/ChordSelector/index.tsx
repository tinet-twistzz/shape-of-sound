import { useRef } from 'react'

import { copy } from '@/content/copy'
import type { ResonanceChord } from '@/types/domain'

import { CHORD_ORDER } from '../chordMeta'

import styles from './ChordSelector.module.css'

export interface ChordSelectorProps {
  value: ResonanceChord
  onChange: (chord: ResonanceChord) => void
  className?: string
}

/** 共鸣和弦胶囊组：radiogroup 语义，方向键循环切换并同步焦点 */
export function ChordSelector({ value, onChange, className }: ChordSelectorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const classes = [styles.wrapper, className].filter(Boolean).join(' ')

  const move = (from: number, delta: number) => {
    const next = (from + delta + CHORD_ORDER.length) % CHORD_ORDER.length
    onChange(CHORD_ORDER[next])
    refs.current[next]?.focus()
  }

  return (
    <div className={classes}>
      <div className={styles.head}>
        <span className={styles.label}>{copy.sections.studio.chordLabel}</span>
        <span className={`mono ${styles.headCode}`}>{copy.sections.studio.chordCode}</span>
      </div>
      <div className={styles.row} role="radiogroup" aria-label={copy.sections.studio.chordAria}>
        {CHORD_ORDER.map((chord, index) => (
          <button
            key={chord}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={value === chord}
            tabIndex={value === chord ? 0 : -1}
            className={`${styles.pill} ${value === chord ? styles.pillActive : ''}`}
            onClick={() => onChange(chord)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(index, 1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(index, -1)
              } else if (event.key === 'Home') {
                event.preventDefault()
                move(0, 0)
              } else if (event.key === 'End') {
                event.preventDefault()
                move(CHORD_ORDER.length - 1, 0)
              }
            }}
          >
            {copy.sections.studio.chords[chord]}
          </button>
        ))}
      </div>
      <p className={styles.hint}>{copy.sections.studio.chordHints[value]}</p>
    </div>
  )
}