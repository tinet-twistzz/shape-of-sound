import { useId, useRef } from 'react'
import type { CSSProperties } from 'react'

import { copy } from '@/content/copy'

import { TIMBRE_MAX, TIMBRE_MIN, TIMBRE_STEP } from '../timbreMeta'

import styles from './TimbreSlider.module.css'

export interface TimbreSliderProps {
  value: number
  onChange: (timbre: number) => void
  /** 松手 / 松开按键时触发：试听当前音色 */
  onCommit: (timbre: number) => void
  className?: string
}

const TICKS = 33

/** 音色形态滑杆：温润圆岛 ↔ 清冽星芒，拖动实时改耦合比，松手试听泛音色泽 */
export function TimbreSlider({ value, onChange, onCommit, className }: TimbreSliderProps) {
  const id = useId()
  const dirty = useRef(false)
  const latest = useRef(value)
  latest.current = value

  const percent = ((value - TIMBRE_MIN) / (TIMBRE_MAX - TIMBRE_MIN)) * 100
  const description = copy.sections.studio.timbreDescribe(value)
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
      onKeyUp={commit}
    >
      <div className={styles.head}>
        <label className={styles.label} htmlFor={id}>
          {copy.sections.studio.timbreLabel}
        </label>
        <span className={`mono ${styles.headCode}`}>{copy.sections.studio.timbreCode}</span>
      </div>

      <p className={`display ${styles.description}`} aria-hidden="true">
        {description}
      </p>

      <input
        id={id}
        type="range"
        className={styles.input}
        style={{ '--fill': `${percent}%` } as CSSProperties}
        min={TIMBRE_MIN}
        max={TIMBRE_MAX}
        step={TIMBRE_STEP}
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
        <span>{copy.sections.studio.timbreLow}</span>
        <span className={`mono ${styles.endsArrow}`}>↔</span>
        <span>{copy.sections.studio.timbreHigh}</span>
      </div>

      <p className={styles.hint}>{copy.sections.studio.timbreHint}</p>
    </div>
  )
}