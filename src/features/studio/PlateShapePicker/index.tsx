import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

import { copy } from '@/content/copy'
import type { PlateShape } from '@/types/domain'

import styles from './PlateShapePicker.module.css'

export interface PlateShapePickerProps {
  value: PlateShape
  onChange: (shape: PlateShape) => void
  className?: string
}

const t = copy.sections.studio

const SHAPES: readonly PlateShape[] = ['square', 'circle', 'hexagon', 'triangle']

function ShapeGlyph({ shape }: { shape: PlateShape }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (shape) {
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.5" />
        </svg>
      )
    case 'hexagon':
      return (
        <svg {...common}>
          <path d="M12 4 18.9 8v8L12 20l-6.9-4V8Z" />
        </svg>
      )
    case 'triangle':
      return (
        <svg {...common}>
          <path d="M12 3.5 19.4 16.5H4.6Z" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="4.5" y="4.5" width="15" height="15" />
        </svg>
      )
  }
}

/** 共振盘形状：四块几何图标按钮，滑动调音 / 麦克风模式随时切换 */
export function PlateShapePicker({ value, onChange, className }: PlateShapePickerProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = SHAPES.indexOf(value)
    let next = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % SHAPES.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + SHAPES.length) % SHAPES.length
    }
    if (next >= 0) {
      event.preventDefault()
      onChange(SHAPES[next])
      itemRefs.current[next]?.focus()
    }
  }

  const classes = [styles.picker, className].filter(Boolean).join(' ')

  return (
    <div
      role="radiogroup"
      aria-label={t.plateSwitchAria}
      className={classes}
      onKeyDown={handleKeyDown}
    >
      {SHAPES.map((shape, index) => {
        const active = shape === value
        return (
          <button
            key={shape}
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={[styles.item, active && styles.active].filter(Boolean).join(' ')}
            onClick={() => onChange(shape)}
          >
            <ShapeGlyph shape={shape} />
            <span className={styles.label}>{t.plateShapes[shape]}</span>
          </button>
        )
      })}
    </div>
  )
}