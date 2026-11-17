// TODO: 后续替换为 Canvas 粒子渲染（克拉尼节线物理模拟）。
// 替换时保持 Props（pattern / theme / energy / interactive / className）
// 与 SandCanvasHandle（scatter / snapshot）完全不变，调用方无需改动。
// 当前为 CSS 渐变示意模拟：theme 通过可过渡的自定义属性换沙色，pattern 变化双层淡入淡出。
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'

import { copy } from '@/content/copy'
import type { ParticleTheme, PatternParams } from '@/types/domain'

import styles from './SandCanvas.module.css'

export interface SandCanvasHandle {
  /** 轻撒沙粒：真实实现中给粒子一个随机冲量；当前播放示意抖动 */
  scatter(): void
  /** 导出当前画面；图片导出服务注入前返回 null */
  snapshot(): Promise<Blob | null>
}

export interface SandCanvasProps {
  pattern: PatternParams
  theme: ParticleTheme
  /** 振动能量 0–1，影响沙纹亮度与呼吸感 */
  energy: number
  interactive?: boolean
  className?: string
}

interface SandLayer {
  id: number
  key: string
  pattern: PatternParams
}

const THEME_COLORS: Record<ParticleTheme, { a: string; b: string; glow: string }> = {
  gold: {
    a: 'rgba(243, 201, 105, 0.85)',
    b: 'rgba(247, 214, 138, 0.5)',
    glow: 'rgba(243, 201, 105, 0.16)',
  },
  glacier: {
    a: 'rgba(86, 207, 225, 0.85)',
    b: 'rgba(155, 232, 242, 0.5)',
    glow: 'rgba(86, 207, 225, 0.16)',
  },
  neon: {
    a: 'rgba(157, 78, 221, 0.9)',
    b: 'rgba(86, 207, 225, 0.55)',
    glow: 'rgba(157, 78, 221, 0.2)',
  },
}

const CROSSFADE_MS = 520

function patternKeyOf(pattern: PatternParams): string {
  return `${pattern.n}-${pattern.m}-${pattern.a ?? 0}-${pattern.b ?? 0}`
}

function petalStyle(pattern: PatternParams): CSSProperties {
  const m = Math.max(1, Math.round(pattern.m))
  const n = Math.max(1, Math.round(pattern.n))
  const sector = 360 / (m * 2)
  const petal = sector * 0.42
  const ring = 50 / (n + 1)
  const rotation = ((pattern.a ?? 0) - (pattern.b ?? 0)) * 12
  const mask = `repeating-radial-gradient(circle at 50% 50%, #000 0 ${ring * 0.55}%, transparent ${ring * 0.55}% ${ring}%)`
  return {
    backgroundImage: `repeating-conic-gradient(from ${rotation}deg at 50% 50%, var(--sand-a) 0deg ${petal}deg, transparent ${petal}deg ${sector}deg)`,
    maskImage: mask,
    WebkitMaskImage: mask,
  }
}

function ringStyle(pattern: PatternParams): CSSProperties {
  const n = Math.max(1, Math.round(pattern.n))
  const ring = 50 / (n + 1)
  return {
    backgroundImage: `repeating-radial-gradient(circle at 50% 50%, var(--sand-b) 0 0.5%, transparent 0.5% ${ring}%)`,
  }
}

export const SandCanvas = forwardRef<SandCanvasHandle, SandCanvasProps>(function SandCanvas(
  { pattern, theme, energy, interactive = false, className },
  ref,
) {
  const clampedEnergy = Math.min(1, Math.max(0, energy))
  const key = patternKeyOf(pattern)
  const [layers, setLayers] = useState<SandLayer[]>([{ id: 0, key, pattern }])
  const [scattering, setScattering] = useState(false)
  const layerId = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // pattern 变化：新层淡入覆盖旧层，随后移除旧层，形成淡入淡出
  useEffect(() => {
    layerId.current += 1
    const id = layerId.current
    setLayers((prev) =>
      prev[prev.length - 1].key === key ? prev : [...prev, { id, key, pattern }].slice(-2),
    )
    const timer = window.setTimeout(() => setLayers((prev) => prev.slice(-1)), CROSSFADE_MS)
    return () => window.clearTimeout(timer)
  }, [key, pattern])

  const scatter = useCallback(() => {
    // TODO: 粒子实现注入后，这里改为给所有粒子施加随机冲量
    setScattering(false)
    requestAnimationFrame(() => requestAnimationFrame(() => setScattering(true)))
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      scatter,
      snapshot: async () => {
        // TODO: 图片导出服务注入后，将当前沙盘渲染为 PNG Blob
        return null
      },
    }),
    [scatter],
  )

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return
    const node = containerRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    node.style.setProperty(
      '--mx',
      `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`,
    )
    node.style.setProperty(
      '--my',
      `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`,
    )
  }

  const colors = THEME_COLORS[theme]
  const vars = {
    '--sand-a': colors.a,
    '--sand-b': colors.b,
    '--sand-glow': colors.glow,
    '--energy': clampedEnergy,
  } as CSSProperties

  const classes = [styles.canvas, interactive && styles.interactive, className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={containerRef}
      className={classes}
      style={vars}
      role="img"
      aria-label={copy.sand.canvasAria(pattern.n, pattern.m, copy.sections.studio.themes[theme])}
      onPointerMove={handlePointerMove}
    >
      <div className={styles.glow} aria-hidden="true" />
      <div
        className={[styles.sandWrap, scattering && styles.scattering].filter(Boolean).join(' ')}
        onAnimationEnd={() => setScattering(false)}
        aria-hidden="true"
      >
        {layers.map((layer) => (
          <div key={layer.id} className={styles.layer}>
            <div className={styles.rings} style={ringStyle(layer.pattern)} />
            <div className={styles.petals} style={petalStyle(layer.pattern)} />
          </div>
        ))}
      </div>
      {interactive && <div className={styles.spotlight} aria-hidden="true" />}
      <svg className={styles.grid} viewBox="0 0 100 100" aria-hidden="true">
        <line x1="50" y1="4" x2="50" y2="96" strokeDasharray="1 4" />
        <line x1="4" y1="50" x2="96" y2="50" strokeDasharray="1 4" />
        {Array.from({ length: 9 }, (_, i) => {
          const p = (i + 1) * 10
          return (
            <g key={p}>
              <line x1={p} y1="0" x2={p} y2="1.6" />
              <line x1={p} y1="98.4" x2={p} y2="100" />
              <line x1="0" y1={p} x2="1.6" y2={p} />
              <line x1="98.4" y1={p} x2="100" y2={p} />
            </g>
          )
        })}
        <path d="M1 6 V1 H6" className={styles.corner} />
        <path d="M94 1 H99 V6" className={styles.corner} />
        <path d="M99 94 V99 H94" className={styles.corner} />
        <path d="M6 99 H1 V94" className={styles.corner} />
        <circle cx="50" cy="50" r="0.9" className={styles.centerDot} />
      </svg>
      <span className={`mono ${styles.plateCaption}`}>{copy.sand.plateCaption}</span>
      {import.meta.env.DEV && (
        <span className={`mono ${styles.readout}`}>
          n={pattern.n} m={pattern.m} · {theme} · E={clampedEnergy.toFixed(2)}
        </span>
      )}
    </div>
  )
})
