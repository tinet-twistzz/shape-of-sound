import { useId, useRef } from 'react'
import type { CSSProperties } from 'react'

import { copy } from '@/content/copy'

import { FREQ_MAX, FREQ_MIN, FREQ_STEP, describeFrequency } from '../frequencyMeta'

import styles from './FrequencySlider.module.css'

export interface FrequencySliderProps {
  value: number
  onChange: (frequencyHz: number) => void
  /** 松手 / 松开按键时触发：试听当前频率 */
  onCommit: (frequencyHz: number) => void
  className?: string
}

const TICKS = 33

/** 频率滑杆：只给听感描述，不显示 Hz；拖动实时改图案，松手试听 */
export function FrequencySlider({ value, onChange, onCommit, className }: FrequencySliderProps) {
  const id = useId()
  const dirty = useRef(false)
  const latest = useRef(value)
  latest.current = value

  const percent = ((value - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * 100
  const description = describeFrequency(value)
  const classes = [styles.wrapper, className].filter(Boolean).join(' ')

  const commit = () => {
    if (!dirty.current) return
    dirty.current = false
    onCommit(latest.current)
  }

  return (
    <div
      className={classes}
      onPointerUp={commit}
      onPointerCancel={commit}
      onTouchEnd={commit}
      onKeyUp={commit}
      onBlur={commit}
    >
      <div className={styles.head}>
        <label className={styles.label} htmlFor={id}>
          {copy.sections.studio.sliderLabel}
        </label>
        <span className={`mono ${styles.headCode}`}>{copy.sections.studio.sliderCode}</span>
      </div>

      <p className={`display ${styles.description}`} aria-hidden="true">
        {description}
      </p>

      <input
        id={id}
        type="range"
        className={styles.input}
        style={{ '--fill': `${percent}%` } as CSSProperties}
        min={FREQ_MIN}
        max={FREQ_MAX}
        step={FREQ_STEP}
        value={value}
        aria-valuetext={description}
        onChange={(event) => {
          dirty.current = true
          onChange(Number(event.target.value))
        }}
      />

      <div className={styles.ruler} aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <span key={i} className={i % 8 === 0 ? styles.tickMajor : styles.tick} />
        ))}
      </div>

      <div className={styles.ends} aria-hidden="true">
        <span>{copy.sections.studio.sliderLow}</span>
        <span className={`mono ${styles.endsArrow}`}>↔</span>
        <span>{copy.sections.studio.sliderHigh}</span>
      </div>

      <p className={styles.hint}>{copy.sections.studio.sliderHint}</p>
    </div>
  )
}
