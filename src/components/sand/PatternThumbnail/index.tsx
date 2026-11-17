// 克拉尼驻波静帧缩略图：z(x,y) = a·cos(πnx)·cos(πmy) + b·cos(πmx)·cos(πny)，(x,y) ∈ [-1,1]²。
// 与 SandCanvas 同一方程与配色，波节线处用确定性哈希噪点模拟细沙聚集的颗粒质感，只重绘一次。
import { useEffect, useRef } from 'react'

import { copy } from '@/content/copy'
import type { ParticleTheme, PatternParams } from '@/types/domain'

import styles from './PatternThumbnail.module.css'

export interface PatternThumbnailProps {
  pattern: PatternParams
  size?: number
  theme?: ParticleTheme
  className?: string
}

const BG: [number, number, number] = [10, 12, 16]
const NODE_AMP = 0.14

const THEME_RGB: Record<Exclude<ParticleTheme, 'neon'>, { base: number[]; bright: number[] }> = {
  gold: { base: [243, 201, 105], bright: [247, 220, 150] },
  glacier: { base: [86, 207, 225], bright: [226, 248, 251] },
}

// neon 三圈：暖金 → 琉璃青 → 极光紫，环带边界与 SandCanvas 的 r2 0.36 / 1.3 一致
const NEON_GOLD = [247, 214, 138]
const NEON_CYAN = [86, 207, 225]
const NEON_PURPLE = [157, 78, 221]

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function smooth(t: number): number {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

// 像素坐标整数哈希 → [0,1)，确定性噪点，重绘不闪烁
function grainHash(i: number, j: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function renderFrame(
  canvas: HTMLCanvasElement,
  n: number,
  m: number,
  a: number,
  b: number,
  size: number,
  theme: ParticleTheme,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const px = Math.max(2, Math.round(size * dpr))
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const modeN = Math.max(1, Math.round(n))
  const modeM = Math.max(1, Math.round(m))
  const ampA = a
  let ampB = b
  // n === m 且 a + b === 0 时方程恒为 0，改为同相叠加形成正交网格
  if (modeN === modeM && ampA + ampB === 0) ampB = 1
  const norm = Math.abs(ampA) + Math.abs(ampB) || 1

  const coord = new Float32Array(px)
  const cosN = new Float32Array(px)
  const cosM = new Float32Array(px)
  for (let i = 0; i < px; i += 1) {
    const t = -1 + (2 * i) / (px - 1)
    coord[i] = t
    cosN[i] = Math.cos(Math.PI * modeN * t)
    cosM[i] = Math.cos(Math.PI * modeM * t)
  }

  const image = ctx.createImageData(px, px)
  const data = image.data
  const palette = theme === 'neon' ? null : THEME_RGB[theme]

  for (let j = 0; j < px; j += 1) {
    const y = coord[j]
    const cosMy = cosM[j]
    const cosNy = cosN[j]
    for (let i = 0; i < px; i += 1) {
      const z = ampA * cosN[i] * cosMy + ampB * cosM[i] * cosNy
      const amp = Math.abs(z) / norm

      let light = 0
      let brightMix = 0
      const grain = grainHash(i, j)
      if (amp < NODE_AMP) {
        const t = 1 - amp / NODE_AMP
        light = t * t * (0.5 + 0.5 * grain)
        if (grain > 0.86) {
          light = Math.min(1, light + 0.55 * t)
          brightMix = 0.7
        }
      } else if (amp < 0.24 && grain > 0.965) {
        // 波节线外缘散落的零星沙粒
        light = 0.28 * (1 - (amp - NODE_AMP) / 0.1)
      }
      // 柔和发光晕圈
      const halo = clamp01(1 - amp / 0.5)
      light += halo * halo * 0.1

      let baseR: number
      let baseG: number
      let baseB: number
      let brightR: number
      let brightG: number
      let brightB: number
      if (palette) {
        baseR = palette.base[0]
        baseG = palette.base[1]
        baseB = palette.base[2]
        brightR = palette.bright[0]
        brightG = palette.bright[1]
        brightB = palette.bright[2]
      } else {
        const x = coord[i]
        const r = Math.sqrt(x * x + y * y)
        const t1 = smooth((r - 0.48) / 0.24)
        const t2 = smooth((r - 1.02) / 0.24)
        baseR = lerp(lerp(NEON_GOLD[0], NEON_CYAN[0], t1), NEON_PURPLE[0], t2)
        baseG = lerp(lerp(NEON_GOLD[1], NEON_CYAN[1], t1), NEON_PURPLE[1], t2)
        baseB = lerp(lerp(NEON_GOLD[2], NEON_CYAN[2], t1), NEON_PURPLE[2], t2)
        brightR = lerp(baseR, 255, 0.35)
        brightG = lerp(baseG, 255, 0.35)
        brightB = lerp(baseB, 255, 0.35)
      }
      const cr = lerp(baseR, brightR, brightMix)
      const cg = lerp(baseG, brightG, brightMix)
      const cb = lerp(baseB, brightB, brightMix)

      const o = (j * px + i) * 4
      data[o] = Math.min(255, BG[0] + cr * light)
      data[o + 1] = Math.min(255, BG[1] + cg * light)
      data[o + 2] = Math.min(255, BG[2] + cb * light)
      data[o + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}

export function PatternThumbnail({
  pattern,
  size = 64,
  theme = 'gold',
  className,
}: PatternThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { n, m, a = 1, b = -1 } = pattern

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderFrame(canvas, n, m, a, b, size, theme)
  }, [n, m, a, b, size, theme])

  const classes = [styles.box, className].filter(Boolean).join(' ')

  return (
    <span
      className={classes}
      style={{ width: size, height: size }}
      role="img"
      aria-label={copy.sand.thumbnailAria(pattern.n, pattern.m)}
    >
      <canvas ref={canvasRef} className={styles.surface} aria-hidden="true" />
    </span>
  )
}