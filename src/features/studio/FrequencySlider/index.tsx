import { useId, useRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'

import { SpeakerIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import {
  EIGEN_MODES,
  SLIDER_MAX_HZ,
  SLIDER_MIN_HZ,
  SLIDER_STEPS,
  freqToSliderPos,
  getResonanceInfo,
  sliderPosToFreq,
} from '@/services/real/chladniPatternMapper'

import { describeFrequency } from '../frequencyMeta'

import styles from './FrequencySlider.module.css'

export interface FrequencySliderProps {
  value: number
  onChange: (frequencyHz: number) => void
  /** 松手 / 松开按键时触发：试听当前频率 */
  onCommit: (frequencyHz: number) => void
  /** 无需挪动滑块，随时试听当前调音并微激振沙盘 */
  onReplay?: () => void
  className?: string
}

const t = copy.sections.studio
/** 方向键微调步长（占全行程 0.5%）；磁吸窗口设为 ±2，既能命中每个本征态又绝不卡键 */
const KEY_FINE_STEP = 5
const KEY_SNAP_TOLERANCE = 2

function stepKeyboardFrequency(currentHz: number, deltaSteps: number): number {
  const currentPos = freqToSliderPos(currentHz)
  const nextPos = Math.min(SLIDER_STEPS, Math.max(0, currentPos + deltaSteps))
  let nextHz = sliderPosToFreq(nextPos, false)
  for (const mark of EIGEN_MODES) {
    if (Math.abs(nextPos - mark.sliderPos) <= KEY_SNAP_TOLERANCE) {
      nextHz = mark.centerHz
      break
    }
  }
  if (nextHz === currentHz && deltaSteps !== 0) {
    nextHz = Math.min(SLIDER_MAX_HZ, Math.max(SLIDER_MIN_HZ, currentHz + Math.sign(deltaSteps)))
  }
  return nextHz
}

/** 对数频率滑杆：15 个克拉尼本征模态等距舒展，靠近甜点轻磁吸，松手试听 */
export function FrequencySlider({
  value,
  onChange,
  onCommit,
  onReplay,
  className,
}: FrequencySliderProps) {
  const id = useId()
  const dirty = useRef(false)
  const latest = useRef(value)
  latest.current = value

  const sliderPos = freqToSliderPos(value)
  const percent = (sliderPos / SLIDER_STEPS) * 100
  const description = describeFrequency(value)
  const resInfo = getResonanceInfo(value)
  const resonanceLabel = resInfo.locked
    ? t.resonanceLocked(resInfo.n, resInfo.m)
    : t.resonanceTransit(resInfo.n, resInfo.m)
  const classes = [styles.wrapper, className].filter(Boolean).join(' ')

  const commit = () => {
    if (!dirty.current) return
    dirty.current = false
    onCommit(latest.current)
  }

  const emitChange = (nextHz: number) => {
    dirty.current = true
    latest.current = nextHz
    onChange(nextHz)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    let nextHz: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      nextHz = stepKeyboardFrequency(latest.current, KEY_FINE_STEP)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      nextHz = stepKeyboardFrequency(latest.current, -KEY_FINE_STEP)
    } else if (event.key === 'PageUp') {
      const targetIndex = Math.min(EIGEN_MODES.length - 1, resInfo.index + 1)
      nextHz = EIGEN_MODES[targetIndex].centerHz
    } else if (event.key === 'PageDown') {
      const targetIndex = Math.max(0, resInfo.index - 1)
      nextHz = EIGEN_MODES[targetIndex].centerHz
    } else if (event.key === 'Home') {
      nextHz = SLIDER_MIN_HZ
    } else if (event.key === 'End') {
      nextHz = SLIDER_MAX_HZ
    }
    if (nextHz !== null) {
      event.preventDefault()
      emitChange(nextHz)
    }
  }

  return (
    <div className={classes}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <label className={styles.label} htmlFor={id}>
            {t.sliderLabel}
          </label>
          <span className={`mono ${styles.headCode}`}>{t.sliderCode}</span>
        </div>
        <div className={styles.headRight}>
          <span className={`mono ${styles.badge} ${resInfo.locked ? styles.badgeLocked : ''}`}>
            <span className={styles.badgeDot} aria-hidden="true" />
            {resonanceLabel}
          </span>
          <button
            type="button"
            className={styles.replayBtn}
            aria-label={t.replayToneLabel}
            title={t.replayToneLabel}
            onClick={() => {
              if (onReplay) onReplay()
              else onCommit(value)
            }}
          >
            <SpeakerIcon size={14} />
          </button>
        </div>
      </div>

      <p
        className={`display ${styles.description} ${resInfo.locked ? styles.descriptionLocked : ''}`}
        aria-hidden="true"
      >
        {description}
      </p>

      <input
        id={id}
        type="range"
        className={styles.input}
        style={{ '--fill': `${percent}%` } as CSSProperties}
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={sliderPos}
        aria-valuetext={`${description} · ${resonanceLabel}`}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyDown={handleKeyDown}
        onKeyUp={commit}
        onChange={(event) => {
          emitChange(sliderPosToFreq(Number(event.target.value)))
        }}
      />

      <div className={styles.ruler} aria-hidden="true">
        {EIGEN_MODES.map((mark) => {
          const isCurrent = resInfo.index === mark.index
          const isLocked = isCurrent && resInfo.locked
          const tickClass = isLocked ? styles.tickLocked : isCurrent ? styles.tickNear : styles.tick
          return (
            <span
              key={mark.index}
              className={tickClass}
              style={{ left: `${(mark.sliderPos / SLIDER_STEPS) * 100}%` }}
            />
          )
        })}
      </div>

      <div className={styles.ends} aria-hidden="true">
        <span>{t.sliderLow}</span>
        <span className={`mono ${styles.endsArrow}`}>↔</span>
        <span>{t.sliderHigh}</span>
      </div>

      <p className={styles.hint}>{t.sliderHint}</p>
    </div>
  )
}
