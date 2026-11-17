import { useId } from 'react'
import type { CSSProperties } from 'react'

import styles from './Slider.module.css'

export interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** 左端语义标签，如「低沉」 */
  labelLeft?: string
  /** 右端语义标签，如「尖锐」 */
  labelRight?: string
  formatValue?: (value: number) => string
  disabled?: boolean
  className?: string
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  labelLeft,
  labelRight,
  formatValue,
  disabled = false,
  className,
}: SliderProps) {
  const id = useId()
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100
  const readout = formatValue ? formatValue(value) : String(value)
  const classes = [styles.slider, className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className={styles.head}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <output className={`mono ${styles.value}`} htmlFor={id}>
          {readout}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.input}
        style={{ '--fill': `${percent}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={readout}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {(labelLeft || labelRight) && (
        <div className={styles.ends} aria-hidden="true">
          <span>{labelLeft}</span>
          <span className={styles.endsArrow}>↔</span>
          <span>{labelRight}</span>
        </div>
      )}
    </div>
  )
}
