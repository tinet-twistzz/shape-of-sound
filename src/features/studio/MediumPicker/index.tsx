import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

import { copy } from '@/content/copy'
import type { ParticleMedium } from '@/types/domain'

import styles from './MediumPicker.module.css'

export interface MediumPickerProps {
  value: ParticleMedium
  onChange: (medium: ParticleMedium) => void
  className?: string
}

const t = copy.sections.studio

const MEDIA: readonly ParticleMedium[] = ['sand', 'mercury', 'filings', 'spores']

function MediumGlyph({ medium }: { medium: ParticleMedium }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (medium) {
    case 'mercury':
      return (
        <svg {...common}>
          <path d="M12 4c2.8 3.2 4.2 5.4 4.2 7.4a4.2 4.2 0 0 1-8.4 0C7.8 9.4 9.2 7.2 12 4Z" />
          <path d="M4.5 15.5a7.5 7.5 0 0 0 15 0" />
        </svg>
      )
    case 'filings':
      return (
        <svg {...common}>
          <path d="M4 9l5-2M7 13l5-2M10 17l5-2M12 8l5-2M15 12l5-2" />
        </svg>
      )
    case 'spores':
      return (
        <svg {...common}>
          <path d="M12.5 12a1.5 1.5 0 0 0-3 0 3 3 0 0 0 6 0 5 5 0 0 0-10 0 7 7 0 0 0 14 0" />
          <path d="M18.5 4v2.4M17.3 5.2h2.4M5 17.6v2M4 18.6h2" />
        </svg>
      )
    default:
      return (
        <svg {...common} strokeWidth={0} fill="currentColor">
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="12.5" cy="6" r="1" />
          <circle cx="17.5" cy="8" r="1.3" />
          <circle cx="6" cy="12.5" r="1" />
          <circle cx="11.5" cy="12" r="1.4" />
          <circle cx="17" cy="13" r="1" />
          <circle cx="8" cy="17.5" r="1.3" />
          <circle cx="13.5" cy="17" r="1" />
          <circle cx="18" cy="17.5" r="1.2" />
        </svg>
      )
  }
}

/** 显影材质：四种物理介质图标按钮，与色泽正交组合，方向键循环切换 */
export function MediumPicker({ value, onChange, className }: MediumPickerProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = MEDIA.indexOf(value)
    let next = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % MEDIA.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + MEDIA.length) % MEDIA.length
    }
    if (next >= 0) {
      event.preventDefault()
      onChange(MEDIA[next])
      itemRefs.current[next]?.focus()
    }
  }

  const classes = [styles.picker, className].filter(Boolean).join(' ')

  return (
    <div
      role="radiogroup"
      aria-label={t.mediumSwitchAria}
      className={classes}
      onKeyDown={handleKeyDown}
    >
      {MEDIA.map((medium, index) => {
        const active = medium === value
        return (
          <button
            key={medium}
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={[styles.item, active && styles.active].filter(Boolean).join(' ')}
            onClick={() => onChange(medium)}
          >
            <MediumGlyph medium={medium} />
            <span className={styles.label}>{t.mediums[medium]}</span>
          </button>
        )
      })}
    </div>
  )
}