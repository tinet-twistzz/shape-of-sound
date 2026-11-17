import { useMemo } from 'react'

import { copy } from '@/content/copy'

import styles from './WaveIndicator.module.css'

export interface WaveIndicatorProps {
  /** 采样值约在 -1…1；null 时显示静默基线 */
  waveform: Float32Array | number[] | null
  /** 是否有实时信号（点亮指示灯与描边光晕） */
  live?: boolean
  className?: string
}

const W = 128
const H = 36
const MID = H / 2
const AMP = MID - 3

/** 纯展示组件：把 waveform 数组画成 SVG 示波器波形 */
export function WaveIndicator({ waveform, live = false, className }: WaveIndicatorProps) {
  const points = useMemo(() => {
    if (!waveform || waveform.length === 0) {
      return `0,${MID} ${W},${MID}`
    }
    const last = waveform.length - 1
    let out = ''
    for (let i = 0; i < waveform.length; i += 1) {
      const x = (i / last) * W
      const y = MID - Math.min(1, Math.max(-1, waveform[i])) * AMP
      out += `${x.toFixed(1)},${y.toFixed(2)} `
    }
    return out.trim()
  }, [waveform])

  const classes = [styles.monitor, live && styles.live, className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={live ? copy.sections.studio.waveAriaLive : copy.sections.studio.waveAriaPreview}
      >
        {Array.from({ length: 7 }, (_, i) => {
          const x = (i + 1) * (W / 8)
          return <line key={x} x1={x} y1={MID - 2} x2={x} y2={MID + 2} className={styles.tick} />
        })}
        <line x1="0" y1={MID} x2={W} y2={MID} className={styles.baseline} />
        <polyline points={points} className={styles.wave} />
      </svg>
    </div>
  )
}
