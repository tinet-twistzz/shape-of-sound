// 克拉尼驻波同构静帧缩略图：与 SandCanvas 共享 chladniEval 求值器与盘形距离场，
// 完整支持方/圆/六角/三角盘形裁剪描边、副模态、扭转场与长声音年轮/多重曝光。
import { useEffect, useRef } from 'react'

import {
  evalChladniGrid,
  patternKeyOf,
  PLATE_R,
  plateSignedDist,
  prepareChladni,
  SQRT3_2,
  TRI_APOTHEM,
  TRI_R,
} from '@/components/sand/chladniEval'
import { copy } from '@/content/copy'
import type { ParticleTheme, PatternParams, PlateShape } from '@/types/domain'

import styles from './PatternThumbnail.module.css'

export interface PatternThumbnailProps {
  pattern: PatternParams
  size?: number
  theme?: ParticleTheme
  className?: string
}

const OUTER_BG: [number, number, number] = [10, 12, 16]
const PLATE_BG: [number, number, number] = [16, 18, 22]
const PLATE_RIM_STROKE = 'rgba(212, 175, 55, 0.44)'
const NODE_AMP = 0.14

const THEME_RGB: Record<
  Exclude<ParticleTheme, 'neon' | 'voice'>,
  { base: number[]; bright: number[] }
> = {
  gold: { base: [243, 201, 105], bright: [247, 220, 150] },
  glacier: { base: [86, 207, 225], bright: [226, 248, 251] },
}

// neon 三圈：暖金 → 琉璃青 → 极光紫，环带阈值 0.6 / 1.14 与 SandCanvas 的 r² < 0.36 / 1.3 严格对齐
const NEON_GOLD = [247, 214, 138]
const NEON_CYAN = [86, 207, 225]
const NEON_PURPLE = [157, 78, 221]
const NEON_R1 = 0.6
const NEON_R2 = 1.14
const NEON_FEATHER = 0.08

// voice 四色：暖金 / 琉璃青 / 极光紫 / 高光星白，与 SandCanvas 的彩沙色桶一致
const VOICE_RGB = [
  [243, 201, 105],
  [86, 207, 225],
  [157, 78, 221],
  [255, 242, 204],
]

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

function strokePlateRim(
  ctx: CanvasRenderingContext2D,
  shape: PlateShape,
  px: number,
  dpr: number,
): void {
  const cx = px / 2
  const cy = px / 2
  const s = (px - 1) / 2
  const mapX = (x: number) => cx + x * s
  const mapY = (y: number) => cy + y * s
  const path = new Path2D()

  switch (shape) {
    case 'circle':
      path.arc(cx, cy, PLATE_R * s, 0, Math.PI * 2)
      break
    case 'hexagon':
      for (let k = 0; k < 6; k += 1) {
        const ang = Math.PI / 6 + (k * Math.PI) / 3
        const vx = mapX(PLATE_R * Math.cos(ang))
        const vy = mapY(PLATE_R * Math.sin(ang))
        if (k === 0) path.moveTo(vx, vy)
        else path.lineTo(vx, vy)
      }
      path.closePath()
      break
    case 'triangle':
      path.moveTo(mapX(0), mapY(-TRI_R))
      path.lineTo(mapX(TRI_R * SQRT3_2), mapY(TRI_APOTHEM))
      path.lineTo(mapX(-TRI_R * SQRT3_2), mapY(TRI_APOTHEM))
      path.closePath()
      break
    default: {
      const r = PLATE_R * s
      path.rect(cx - r, cy - r, r * 2, r * 2)
    }
  }

  ctx.strokeStyle = PLATE_RIM_STROKE
  ctx.lineWidth = Math.max(1, dpr * 0.8)
  ctx.stroke(path)
}

function renderFrame(
  canvas: HTMLCanvasElement,
  pattern: PatternParams,
  size: number,
  theme: ParticleTheme,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const px = Math.max(2, Math.round(size * dpr))
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { shape, norm } = prepareChladni(pattern)
  const rawZ = evalChladniGrid(pattern, px)
  const pxStep = 2 / (px - 1)

  const image = ctx.createImageData(px, px)
  const data = image.data
  const palette = theme === 'neon' || theme === 'voice' ? null : THEME_RGB[theme]

  for (let j = 0; j < px; j += 1) {
    const y = -1 + j * pxStep
    const row = j * px
    for (let i = 0; i < px; i += 1) {
      const x = -1 + i * pxStep
      const o = (row + i) * 4
      const distPx = plateSignedDist(x, y, shape) / pxStep

      // 盘外深色裁剪（带 1px 抗锯齿羽化，与矢量暗金盘缘无缝贴合）
      if (distPx >= 0.5) {
        data[o] = OUTER_BG[0]
        data[o + 1] = OUTER_BG[1]
        data[o + 2] = OUTER_BG[2]
        data[o + 3] = 255
        continue
      }
      const insideCoverage = clamp01(0.5 - distPx)

      const amp = Math.abs(rawZ[row + i]) / norm
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
      light = (light + halo * halo * 0.1) * insideCoverage

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
      } else if (theme === 'voice') {
        // 粗粒度哈希分块取色，模拟不同时刻落下的彩沙交织
        const c = VOICE_RGB[Math.min(3, (grainHash(i >> 2, j >> 2) * 4) | 0)]
        baseR = c[0]
        baseG = c[1]
        baseB = c[2]
        brightR = lerp(baseR, 255, 0.35)
        brightG = lerp(baseG, 255, 0.35)
        brightB = lerp(baseB, 255, 0.35)
      } else {
        const r = Math.sqrt(x * x + y * y)
        const t1 = smooth((r - (NEON_R1 - NEON_FEATHER)) / (NEON_FEATHER * 2))
        const t2 = smooth((r - (NEON_R2 - NEON_FEATHER)) / (NEON_FEATHER * 2))
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

      const bgR = lerp(OUTER_BG[0], PLATE_BG[0], insideCoverage)
      const bgG = lerp(OUTER_BG[1], PLATE_BG[1], insideCoverage)
      const bgB = lerp(OUTER_BG[2], PLATE_BG[2], insideCoverage)

      data[o] = Math.min(255, bgR + cr * light)
      data[o + 1] = Math.min(255, bgG + cg * light)
      data[o + 2] = Math.min(255, bgB + cb * light)
      data[o + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  strokePlateRim(ctx, shape, px, dpr)
}

export function PatternThumbnail({
  pattern,
  size = 64,
  theme = 'gold',
  className,
}: PatternThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderedKeyRef = useRef('')
  const key = patternKeyOf(pattern)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const nextKey = `${key}|${size}|${theme}`
    if (renderedKeyRef.current === nextKey) return
    renderedKeyRef.current = nextKey
    renderFrame(canvas, pattern, size, theme)
  }, [key, pattern, size, theme])

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
