// TODO: 粒子渲染注入后，缩略图可改为离屏 Canvas 静帧；Props 保持不变。
// 当前用玫瑰线（r = cos(n/m · θ)）示意节线图案的疏密与瓣数。
import { useMemo } from 'react'

import { copy } from '@/content/copy'
import type { ParticleTheme, PatternParams } from '@/types/domain'

import styles from './PatternThumbnail.module.css'

export interface PatternThumbnailProps {
  pattern: PatternParams
  size?: number
  theme?: ParticleTheme
  className?: string
}

const THEME_STROKE: Record<ParticleTheme, string> = {
  gold: '#f3c969',
  glacier: '#56cfe1',
  neon: '#9d4edd',
}

export function PatternThumbnail({
  pattern,
  size = 64,
  theme = 'gold',
  className,
}: PatternThumbnailProps) {
  const path = useMemo(() => {
    const n = Math.max(1, Math.round(pattern.n))
    const m = Math.max(1, Math.round(pattern.m))
    const k = n / m
    const samples = Math.min(900, 160 * m)
    const span = Math.PI * 2 * m
    const points: string[] = []
    for (let i = 0; i <= samples; i += 1) {
      const theta = (i / samples) * span
      const r = Math.cos(k * theta) * 0.92
      const x = (r * Math.cos(theta)).toFixed(4)
      const y = (r * Math.sin(theta)).toFixed(4)
      points.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`)
    }
    return points.join(' ') + ' Z'
  }, [pattern.n, pattern.m])

  const classes = [styles.box, className].filter(Boolean).join(' ')
  const stroke = THEME_STROKE[theme]

  return (
    <span
      className={classes}
      style={{ width: size, height: size }}
      role="img"
      aria-label={copy.sand.thumbnailAria(pattern.n, pattern.m)}
    >
      <svg viewBox="-1.05 -1.05 2.1 2.1" width="100%" height="100%" aria-hidden="true">
        <path d={path} fill="none" stroke={stroke} strokeWidth={0.035} opacity={0.9} />
        <circle cx="0" cy="0" r="0.04" fill={stroke} />
      </svg>
    </span>
  )
}
