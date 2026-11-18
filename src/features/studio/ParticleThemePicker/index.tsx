import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

import { copy } from '@/content/copy'
import type { ParticleTheme } from '@/types/domain'

import styles from './ParticleThemePicker.module.css'

export interface ParticleThemePickerProps {
  value: ParticleTheme
  onChange: (theme: ParticleTheme) => void
  className?: string
}

const THEMES: readonly { value: ParticleTheme; label: string }[] = [
  { value: 'gold', label: copy.sections.studio.themes.gold },
  { value: 'glacier', label: copy.sections.studio.themes.glacier },
  { value: 'neon', label: copy.sections.studio.themes.neon },
  { value: 'voice', label: copy.sections.studio.themes.voice },
]

/** 沙粒色泽：四块色样按钮，选中即时换沙色 */
export function ParticleThemePicker({ value, onChange, className }: ParticleThemePickerProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = THEMES.findIndex((theme) => theme.value === value)
    let next = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % THEMES.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + THEMES.length) % THEMES.length
    }
    if (next >= 0) {
      event.preventDefault()
      onChange(THEMES[next].value)
      itemRefs.current[next]?.focus()
    }
  }

  const classes = [styles.picker, className].filter(Boolean).join(' ')

  return (
    <div
      role="radiogroup"
      aria-label={copy.sections.studio.themeLabel}
      className={classes}
      onKeyDown={handleKeyDown}
    >
      {THEMES.map((theme, index) => {
        const active = theme.value === value
        return (
          <button
            key={theme.value}
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={[styles.item, active && styles.active].filter(Boolean).join(' ')}
            onClick={() => onChange(theme.value)}
          >
            <span className={`${styles.swatch} ${styles[theme.value]}`} aria-hidden="true" />
            <span className={styles.label}>{theme.label}</span>
          </button>
        )
      })}
    </div>
  )
}
