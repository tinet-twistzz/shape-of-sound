// 克拉尼驻波粒子沙盘：z(x,y) = a·cos(πnx)·cos(πmy) + b·cos(πmx)·cos(πny)，(x,y) ∈ [-1,1]²。
// 长声音压缩画法：rings 把时间切片画成同心年轮，exposure 取最响瞬间叠印成复合方盘。
// 场查找表仅在模态变化时重建；动画循环内只做双线性插值，不调用三角函数。
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { copy } from '@/content/copy'
import type { ParticleTheme, PatternParams } from '@/types/domain'

import styles from './SandCanvas.module.css'

export interface SandCanvasHandle {
  /** 轻撒沙粒：给所有粒子施加向外弹散的随机初速度，随后自然重聚到波节线 */
  scatter(): void
  /** 导出当前画面为带不透明底色的 PNG Blob */
  snapshot(): Promise<Blob | null>
}

export interface SandCanvasProps {
  pattern: PatternParams
  theme: ParticleTheme
  /** 振动能量 0–1，按比例缩放波腹处的弹跳强度 */
  energy: number
  interactive?: boolean
  className?: string
  /** 沙量密度 0.25–1：实际参与模拟与绘制的粒数 = round(count * density) */
  density?: number
  /** voice 主题当前声音色桶：0 暖金 / 1 琉璃青 / 2 极光紫 / 3 高光星白 */
  activeColorBand?: 0 | 1 | 2 | 3
}

const GRID = 128
const DESKTOP_COUNT = 30000
const MOBILE_COUNT = 7000
const MIN_COUNT = 3000
const BOARD = 0.96
const JITTER = 0.05
const MIGRATE = 0.004
const DAMPING = 0.86
const REST_DAMPING = 0.55
const REST_AMP = 0.02
const POINTER_RADIUS = 0.24
const POINTER_PUSH = 0.02
const BG_SOLID = '#0A0C10'
const BG_TRAIL = 'rgba(10, 12, 16, 0.28)'

const THEME_COLORS: Record<ParticleTheme, { base: string; bright: string; glow: string }> = {
  gold: {
    base: 'rgba(243, 201, 105, 0.6)',
    bright: 'rgba(247, 220, 150, 0.95)',
    glow: 'rgba(243, 201, 105, 0.16)',
  },
  glacier: {
    base: 'rgba(86, 207, 225, 0.58)',
    bright: 'rgba(226, 248, 251, 0.95)',
    glow: 'rgba(86, 207, 225, 0.16)',
  },
  neon: {
    base: 'rgba(86, 207, 225, 0.8)',
    bright: 'rgba(247, 214, 138, 0.95)',
    glow: 'rgba(157, 78, 221, 0.2)',
  },
  voice: {
    base: 'rgba(243, 201, 105, 0.85)',
    bright: 'rgba(255, 242, 204, 0.95)',
    glow: 'rgba(157, 78, 221, 0.18)',
  },
}

// neon 主题按到中心距离分三层环带：亮金 → 琉璃青 → 极光紫
const NEON_BANDS = [
  'rgba(247, 214, 138, 0.95)',
  'rgba(86, 207, 225, 0.85)',
  'rgba(157, 78, 221, 0.85)',
]

// voice 主题四色桶：暖金 / 琉璃青 / 极光紫 / 高光星白，落入画布时锁定、不再随位置改写
const VOICE_BANDS = [
  'rgba(243, 201, 105, 0.85)',
  'rgba(86, 207, 225, 0.85)',
  'rgba(157, 78, 221, 0.85)',
  'rgba(255, 242, 204, 0.95)',
]

interface Field {
  amp: Float32Array
  dirX: Float32Array
  dirY: Float32Array
}

interface Sim {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  field: Field
  patternKey: string
  circle: boolean
  theme: ParticleTheme
  energy: number
  interactive: boolean
  reduced: boolean
  particles: Float32Array
  bands: Uint8Array
  count: number
  density: number
  activeCount: number
  activeColorBand: 0 | 1 | 2 | 3
  w: number
  h: number
  dpr: number
  pointer: { x: number; y: number; on: boolean }
  inView: boolean
  raf: number
  last: number
  fpsEma: number
  lowMs: number
  readoutAt: number
  sample: Float32Array
  onReadout: (fps: number, count: number) => void
}

function patternKeyOf(pattern: PatternParams): string {
  const sec = pattern.secondary
  const secKey = sec ? `${sec.n}.${sec.m}.${sec.weight}` : '0'
  const slices = pattern.timelineSlices
  const sliceKey = slices
    ? slices.map((s) => `${s.n}.${s.m}.${s.a}.${s.b}.${s.weight}`).join('|')
    : '0'
  return `${pattern.n}-${pattern.m}-${pattern.a ?? 0}-${pattern.b ?? 0}-${pattern.plateShape ?? 'square'}-${secKey}-${pattern.compressionMode ?? 'live'}-${sliceKey}`
}

function isCirclePattern(pattern: PatternParams): boolean {
  if (pattern.compressionMode === 'rings') return true
  if (pattern.compressionMode === 'exposure') return false
  return pattern.plateShape === 'circle'
}

type TimelineSlice = NonNullable<PatternParams['timelineSlices']>[number]

function ringSliceZ(slice: TimelineSlice, r: number, theta: number): number {
  const loud = 0.35 + 0.65 * slice.weight
  return Math.cos(Math.PI * slice.m * r) * (slice.a * Math.cos(slice.n * theta) + slice.b) * loud
}

// 声音年轮：半径等分为 K 圈环带，第 i 片声纹画第 i 圈，
// 切片中心处纯粹呈现本片花纹，环带交界用 smoothstep 平滑过渡
function buildRingsField(slices: TimelineSlice[], amp: Float32Array): void {
  const k = slices.length
  for (let j = 0; j < GRID; j += 1) {
    const y = -1 + (2 * j) / (GRID - 1)
    for (let i = 0; i < GRID; i += 1) {
      const x = -1 + (2 * i) / (GRID - 1)
      const r = Math.sqrt(x * x + y * y)
      if (r > 1) continue
      const theta = Math.atan2(y, x)
      const pos = r * k - 0.5
      let i0 = Math.floor(pos)
      let frac = pos - i0
      if (i0 < 0) {
        i0 = 0
        frac = 0
      } else if (i0 >= k - 1) {
        i0 = k - 1
        frac = 0
      }
      const i1 = Math.min(i0 + 1, k - 1)
      const t = frac * frac * (3 - 2 * frac)
      const z0 = ringSliceZ(slices[i0], r, theta)
      const z1 = i1 === i0 ? z0 : ringSliceZ(slices[i1], r, theta)
      amp[j * GRID + i] = Math.abs(z0 + (z1 - z0) * t)
    }
  }
}

// 多重曝光：取响度权重最高的前 3 个瞬间（弱于冠军 30% 的层丢弃，
// 声音单薄时自然退化为 1~2 层），按权重叠成一张复合方盘
function buildExposureField(slices: TimelineSlice[], amp: Float32Array): void {
  const sorted = [...slices].sort((p, q) => q.weight - p.weight)
  const top = sorted
    .slice(0, 3)
    .filter((s, idx) => idx === 0 || s.weight >= sorted[0].weight * 0.3)
  let wSum = 0
  for (const s of top) wSum += s.weight
  const layers = top.map((s) => {
    let b = s.b
    if (s.n === s.m && s.a + b === 0) b = 1
    return { n: s.n, m: s.m, a: s.a, b, w: (s.weight / wSum) * 1.8 }
  })
  const cosN = layers.map(() => new Float32Array(GRID))
  const cosM = layers.map(() => new Float32Array(GRID))
  for (let i = 0; i < GRID; i += 1) {
    const t = -1 + (2 * i) / (GRID - 1)
    for (let l = 0; l < layers.length; l += 1) {
      cosN[l][i] = Math.cos(Math.PI * layers[l].n * t)
      cosM[l][i] = Math.cos(Math.PI * layers[l].m * t)
    }
  }
  for (let j = 0; j < GRID; j += 1) {
    for (let i = 0; i < GRID; i += 1) {
      let z = 0
      for (let l = 0; l < layers.length; l += 1) {
        const { a, b, w } = layers[l]
        z += w * (a * cosN[l][i] * cosM[l][j] + b * cosM[l][i] * cosN[l][j])
      }
      amp[j * GRID + i] = Math.abs(z)
    }
  }
}

function buildField(pattern: PatternParams): Field {
  const n = Math.max(1, Math.round(pattern.n))
  const m = Math.max(1, Math.round(pattern.m))
  const a = pattern.a ?? 1
  let b = pattern.b ?? -1
  // n === m 且 a + b === 0 时方程恒为 0，改为同相叠加形成正交网格
  if (n === m && a + b === 0) b = 1
  const sec = pattern.secondary
  const n2 = sec ? Math.max(1, Math.round(sec.n)) : 0
  const m2 = sec ? Math.max(1, Math.round(sec.m)) : 0
  const w2 = sec ? sec.weight : 0
  // 第二层 n === m 时反相叠加恒为 0，同样改同相
  const sign2 = n2 === m2 ? 1 : -1

  const size = GRID * GRID
  const amp = new Float32Array(size)
  const dirX = new Float32Array(size)
  const dirY = new Float32Array(size)

  const slices = pattern.timelineSlices
  if (pattern.compressionMode === 'rings' && slices && slices.length > 0) {
    buildRingsField(slices, amp)
  } else if (pattern.compressionMode === 'exposure' && slices && slices.length > 0) {
    buildExposureField(slices, amp)
  } else if (pattern.plateShape === 'circle') {
    // 圆盘：放射花瓣 × 同心波纹，z(r,θ) = cos(πmr)·(a·cos(nθ) + b)，圆外置 0
    for (let j = 0; j < GRID; j += 1) {
      const y = -1 + (2 * j) / (GRID - 1)
      for (let i = 0; i < GRID; i += 1) {
        const x = -1 + (2 * i) / (GRID - 1)
        const r = Math.sqrt(x * x + y * y)
        if (r > 1) continue
        const theta = Math.atan2(y, x)
        let z = Math.cos(Math.PI * m * r) * (a * Math.cos(n * theta) + b)
        if (sec) {
          z += w2 * Math.cos(Math.PI * m2 * r) * (a * Math.cos(n2 * theta) + b)
        }
        amp[j * GRID + i] = Math.abs(z)
      }
    }
  } else {
    const cosN = new Float32Array(GRID)
    const cosM = new Float32Array(GRID)
    const cosN2 = new Float32Array(GRID)
    const cosM2 = new Float32Array(GRID)
    for (let i = 0; i < GRID; i += 1) {
      const t = -1 + (2 * i) / (GRID - 1)
      cosN[i] = Math.cos(Math.PI * n * t)
      cosM[i] = Math.cos(Math.PI * m * t)
      if (sec) {
        cosN2[i] = Math.cos(Math.PI * n2 * t)
        cosM2[i] = Math.cos(Math.PI * m2 * t)
      }
    }
    for (let j = 0; j < GRID; j += 1) {
      for (let i = 0; i < GRID; i += 1) {
        let z = a * cosN[i] * cosM[j] + b * cosM[i] * cosN[j]
        if (sec) {
          z += w2 * (cosN2[i] * cosM2[j] + sign2 * cosM2[i] * cosN2[j])
        }
        amp[j * GRID + i] = Math.abs(z)
      }
    }
  }
  // 迁移方向 = -∇amp（中央差分），归一化后供粒子向波节线漂移
  const invStep = (GRID - 1) / 2
  for (let j = 0; j < GRID; j += 1) {
    for (let i = 0; i < GRID; i += 1) {
      const idx = j * GRID + i
      const il = Math.max(i - 1, 0)
      const ir = Math.min(i + 1, GRID - 1)
      const jt = Math.max(j - 1, 0)
      const jb = Math.min(j + 1, GRID - 1)
      const gx = (amp[j * GRID + ir] - amp[j * GRID + il]) * invStep * 0.5
      const gy = (amp[jb * GRID + i] - amp[jt * GRID + i]) * invStep * 0.5
      const len = Math.sqrt(gx * gx + gy * gy)
      if (len > 1e-6) {
        dirX[idx] = -gx / len
        dirY[idx] = -gy / len
      }
    }
  }
  return { amp, dirX, dirY }
}

function seedRange(sim: Sim, from: number, to: number, recolor = true): void {
  const p = sim.particles
  for (let i = from; i < to; i += 1) {
    const o = i * 4
    if (sim.circle) {
      const r = BOARD * Math.sqrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      p[o] = r * Math.cos(theta)
      p[o + 1] = r * Math.sin(theta)
    } else {
      p[o] = (Math.random() * 2 - 1) * BOARD
      p[o + 1] = (Math.random() * 2 - 1) * BOARD
    }
    p[o + 2] = 0
    p[o + 3] = 0
    if (recolor && sim.theme === 'voice') sim.bands[i] = sim.activeColorBand
  }
}

// 换盘形重撒：只重置位置，保留彩沙已锁定的颜色记忆
function seedParticles(sim: Sim): void {
  seedRange(sim, 0, sim.count, false)
}

function sampleField(sim: Sim, x: number, y: number): void {
  const f = sim.field
  const u = (x + 1) * ((GRID - 1) / 2)
  const v = (y + 1) * ((GRID - 1) / 2)
  const i = u | 0
  const j = v | 0
  const fu = u - i
  const fv = v - j
  const idx = j * GRID + i
  const w00 = (1 - fu) * (1 - fv)
  const w10 = fu * (1 - fv)
  const w01 = (1 - fu) * fv
  const w11 = fu * fv
  const s = sim.sample
  s[0] =
    f.amp[idx] * w00 + f.amp[idx + 1] * w10 + f.amp[idx + GRID] * w01 + f.amp[idx + GRID + 1] * w11
  s[1] =
    f.dirX[idx] * w00 +
    f.dirX[idx + 1] * w10 +
    f.dirX[idx + GRID] * w01 +
    f.dirX[idx + GRID + 1] * w11
  s[2] =
    f.dirY[idx] * w00 +
    f.dirY[idx + 1] * w10 +
    f.dirY[idx + GRID] * w01 +
    f.dirY[idx + GRID + 1] * w11
}

function stepSim(sim: Sim): void {
  const p = sim.particles
  const bands = sim.bands
  const energy = sim.energy
  const pointer = sim.pointer
  const pointerOn = pointer.on && sim.interactive
  const radiusSq = POINTER_RADIUS * POINTER_RADIUS
  const active = sim.activeCount
  // voice 主题色桶在落沙时锁定，不随位置覆盖，保留不同时刻的声音色彩
  const lockBands = sim.theme === 'voice'
  for (let i = 0; i < active; i += 1) {
    const o = i * 4
    let x = p[o]
    let y = p[o + 1]
    let vx = p[o + 2]
    let vy = p[o + 3]
    sampleField(sim, x, y)
    const amp = sim.sample[0]
    // 波腹处随机弹跳，强度随 amp 与 energy 缩放；波节处 amp≈0 自然安歇
    const kick = amp * energy * JITTER
    vx += (Math.random() - 0.5) * kick
    vy += (Math.random() - 0.5) * kick
    // 向振幅更小方向（波节线）迁移
    const pull = amp * MIGRATE
    vx += sim.sample[1] * pull
    vy += sim.sample[2] * pull
    if (pointerOn) {
      const dx = x - pointer.x
      const dy = y - pointer.y
      const d2 = dx * dx + dy * dy
      if (d2 < radiusSq && d2 > 1e-8) {
        const d = Math.sqrt(d2)
        const f = (POINTER_PUSH * (1 - d / POINTER_RADIUS)) / d
        vx += dx * f
        vy += dy * f
      }
    }
    const damp = amp < REST_AMP ? REST_DAMPING : DAMPING
    vx *= damp
    vy *= damp
    x += vx
    y += vy
    if (sim.circle) {
      const r2 = x * x + y * y
      if (r2 > BOARD * BOARD) {
        const r = Math.sqrt(r2)
        const ux = x / r
        const uy = y / r
        x = ux * BOARD
        y = uy * BOARD
        const vn = vx * ux + vy * uy
        if (vn > 0) {
          vx -= 1.5 * vn * ux
          vy -= 1.5 * vn * uy
        }
      }
    } else {
      if (x > BOARD) {
        x = BOARD
        vx *= -0.5
      } else if (x < -BOARD) {
        x = -BOARD
        vx *= -0.5
      }
      if (y > BOARD) {
        y = BOARD
        vy *= -0.5
      } else if (y < -BOARD) {
        y = -BOARD
        vy *= -0.5
      }
    }
    p[o] = x
    p[o + 1] = y
    p[o + 2] = vx
    p[o + 3] = vy
    if (!lockBands) {
      const r2 = x * x + y * y
      bands[i] = r2 < 0.36 ? 0 : r2 < 1.3 ? 1 : 2
    }
  }
}

function drawParticles(sim: Sim): void {
  const { ctx, w, h, activeCount: count, particles: p, dpr } = sim
  if (w === 0 || h === 0) return
  const sx = w / 2
  const sy = h / 2
  if (sim.theme === 'voice') {
    const size = 1.5 * dpr
    const half = size / 2
    const fastSize = 2.2 * dpr
    const fastHalf = fastSize / 2
    // 四桶批绘制只切 4 次 fillStyle；高速粒子同桶内放大提亮，保留真沙微光
    for (let band = 0; band < 4; band += 1) {
      ctx.fillStyle = VOICE_BANDS[band]
      for (let i = 0; i < count; i += 1) {
        if (sim.bands[i] !== band) continue
        const o = i * 4
        const vx = p[o + 2]
        const vy = p[o + 3]
        if (vx * vx + vy * vy > 1e-4) {
          ctx.fillRect(p[o] * sx + sx - fastHalf, p[o + 1] * sy + sy - fastHalf, fastSize, fastSize)
        } else {
          ctx.fillRect(p[o] * sx + sx - half, p[o + 1] * sy + sy - half, size, size)
        }
      }
    }
    return
  }
  if (sim.theme === 'neon') {
    const size = 1.5 * dpr
    const half = size / 2
    for (let band = 0; band < 3; band += 1) {
      ctx.fillStyle = NEON_BANDS[band]
      for (let i = 0; i < count; i += 1) {
        if (sim.bands[i] !== band) continue
        const o = i * 4
        ctx.fillRect(p[o] * sx + sx - half, p[o + 1] * sy + sy - half, size, size)
      }
    }
    return
  }
  const colors = THEME_COLORS[sim.theme]
  const split = (count * 0.7) | 0
  const baseSize = 1.2 * dpr
  const baseHalf = baseSize / 2
  ctx.fillStyle = colors.base
  for (let i = 0; i < split; i += 1) {
    const o = i * 4
    ctx.fillRect(p[o] * sx + sx - baseHalf, p[o + 1] * sy + sy - baseHalf, baseSize, baseSize)
  }
  const brightSize = 1.8 * dpr
  const brightHalf = brightSize / 2
  ctx.fillStyle = colors.bright
  for (let i = split; i < count; i += 1) {
    const o = i * 4
    ctx.fillRect(p[o] * sx + sx - brightHalf, p[o + 1] * sy + sy - brightHalf, brightSize, brightSize)
  }
}

function cleanDraw(sim: Sim): void {
  sim.ctx.fillStyle = BG_SOLID
  sim.ctx.fillRect(0, 0, sim.w, sim.h)
  drawParticles(sim)
}

function trailDraw(sim: Sim): void {
  sim.ctx.fillStyle = BG_TRAIL
  sim.ctx.fillRect(0, 0, sim.w, sim.h)
  drawParticles(sim)
}

// prefers-reduced-motion：不做持续动画，直接同步收敛到波节线后静态呈现
function settle(sim: Sim): void {
  const energy = sim.energy
  const pointerOn = sim.pointer.on
  sim.energy = 0
  sim.pointer.on = false
  for (let k = 0; k < 200; k += 1) stepSim(sim)
  sim.energy = energy
  sim.pointer.on = pointerOn
  cleanDraw(sim)
}

function shouldRun(sim: Sim): boolean {
  return !sim.reduced && sim.inView && !document.hidden
}

function syncRunning(sim: Sim): void {
  if (shouldRun(sim)) {
    if (sim.raf === 0) {
      sim.last = performance.now()
      sim.raf = requestAnimationFrame((t) => frame(sim, t))
    }
  } else if (sim.raf !== 0) {
    cancelAnimationFrame(sim.raf)
    sim.raf = 0
  }
}

function frame(sim: Sim, now: number): void {
  sim.raf = 0
  if (!shouldRun(sim)) return
  const dt = now - sim.last
  sim.last = now
  if (dt > 0 && dt < 200) {
    sim.fpsEma = sim.fpsEma === 0 ? 1000 / dt : sim.fpsEma * 0.9 + (1000 / dt) * 0.1
    // FPS 连续 1.5s 低于 45：阶梯削减 25% 粒子，下限 3000
    if (sim.fpsEma < 45) {
      sim.lowMs += dt
      if (sim.lowMs >= 1500 && sim.count > MIN_COUNT) {
        sim.count = Math.max(MIN_COUNT, (sim.count * 0.75) | 0)
        sim.activeCount = Math.round(sim.count * sim.density)
        sim.lowMs = 0
      }
    } else {
      sim.lowMs = 0
    }
  }
  stepSim(sim)
  trailDraw(sim)
  if (now - sim.readoutAt > 500) {
    sim.readoutAt = now
    sim.onReadout(Math.round(sim.fpsEma), sim.activeCount)
  }
  sim.raf = requestAnimationFrame((t) => frame(sim, t))
}

function isMobileDevice(): boolean {
  return window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches
}

export const SandCanvas = forwardRef<SandCanvasHandle, SandCanvasProps>(function SandCanvas(
  { pattern, theme, energy, interactive = false, className, density = 1, activeColorBand = 1 },
  ref,
) {
  const clampedEnergy = Math.min(1, Math.max(0, energy))
  const clampedDensity = Math.min(1, Math.max(0.25, density))
  const key = patternKeyOf(pattern)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<Sim | null>(null)
  const [readout, setReadout] = useState({ fps: 0, count: 0 })
  const initialProps = useRef({
    pattern,
    theme,
    energy: clampedEnergy,
    interactive,
    density: clampedDensity,
    activeColorBand,
  })

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const init = initialProps.current
    const deviceCount = isMobileDevice() ? MOBILE_COUNT : DESKTOP_COUNT
    const sim: Sim = {
      canvas,
      ctx,
      field: buildField(init.pattern),
      patternKey: patternKeyOf(init.pattern),
      circle: isCirclePattern(init.pattern),
      theme: init.theme,
      energy: init.energy,
      interactive: init.interactive,
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      particles: new Float32Array(DESKTOP_COUNT * 4),
      bands: new Uint8Array(DESKTOP_COUNT),
      count: deviceCount,
      density: init.density,
      activeCount: Math.round(deviceCount * init.density),
      activeColorBand: init.activeColorBand,
      w: 0,
      h: 0,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      pointer: { x: 0, y: 0, on: false },
      inView: true,
      raf: 0,
      last: 0,
      fpsEma: 0,
      lowMs: 0,
      readoutAt: 0,
      sample: new Float32Array(3),
      onReadout: import.meta.env.DEV ? (fps, count) => setReadout({ fps, count }) : () => undefined,
    }
    simRef.current = sim
    seedRange(sim, 0, sim.count)

    const resize = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (w === sim.w && h === sim.h && dpr === sim.dpr) return
      sim.w = w
      sim.h = h
      sim.dpr = dpr
      canvas.width = w
      canvas.height = h
      if (sim.reduced) settle(sim)
      else cleanDraw(sim)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      sim.inView = entry.isIntersecting
      syncRunning(sim)
    })
    intersectionObserver.observe(container)

    const onVisibility = () => syncRunning(sim)
    document.addEventListener('visibilitychange', onVisibility)

    const updatePointer = (event: PointerEvent) => {
      if (!sim.interactive) return
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      sim.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      sim.pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      sim.pointer.on = true
    }
    const clearPointer = () => {
      sim.pointer.on = false
    }
    container.addEventListener('pointermove', updatePointer)
    container.addEventListener('pointerdown', updatePointer)
    container.addEventListener('pointerleave', clearPointer)
    container.addEventListener('pointercancel', clearPointer)

    if (sim.reduced) settle(sim)
    else syncRunning(sim)

    return () => {
      if (sim.raf !== 0) cancelAnimationFrame(sim.raf)
      sim.raf = 0
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      container.removeEventListener('pointermove', updatePointer)
      container.removeEventListener('pointerdown', updatePointer)
      container.removeEventListener('pointerleave', clearPointer)
      container.removeEventListener('pointercancel', clearPointer)
      simRef.current = null
    }
  }, [])

  useEffect(() => {
    const sim = simRef.current
    if (!sim || sim.patternKey === key) return
    sim.patternKey = key
    sim.field = buildField(pattern)
    const circle = isCirclePattern(pattern)
    if (circle !== sim.circle) {
      sim.circle = circle
      seedParticles(sim)
    }
    if (sim.reduced) settle(sim)
    else cleanDraw(sim)
  }, [key, pattern])

  useEffect(() => {
    const sim = simRef.current
    if (!sim || sim.theme === theme) return
    sim.theme = theme
    // 切入彩沙时以当前色桶为底色重新落沙，之后新粒随 density 增长带入新色
    if (theme === 'voice') sim.bands.fill(sim.activeColorBand, 0, sim.count)
    cleanDraw(sim)
  }, [theme])

  useEffect(() => {
    const sim = simRef.current
    if (!sim || sim.density === clampedDensity) return
    const prev = sim.activeCount
    sim.density = clampedDensity
    sim.activeCount = Math.round(sim.count * clampedDensity)
    if (sim.activeCount > prev) seedRange(sim, prev, sim.activeCount)
    if (sim.reduced) settle(sim)
  }, [clampedDensity])

  useEffect(() => {
    const sim = simRef.current
    // 只更新当前色桶，不回写已落沙粒的颜色，保留彩沙记忆
    if (sim) sim.activeColorBand = activeColorBand
  }, [activeColorBand])

  useEffect(() => {
    const sim = simRef.current
    if (sim) sim.energy = clampedEnergy
  }, [clampedEnergy])

  useEffect(() => {
    const sim = simRef.current
    if (sim) sim.interactive = interactive
  }, [interactive])

  const scatter = useCallback(() => {
    const sim = simRef.current
    if (!sim) return
    const p = sim.particles
    for (let i = 0; i < sim.activeCount; i += 1) {
      const o = i * 4
      p[o + 2] += p[o] * 0.06 + (Math.random() - 0.5) * 0.16
      p[o + 3] += p[o + 1] * 0.06 + (Math.random() - 0.5) * 0.16
    }
    if (sim.reduced) settle(sim)
    else syncRunning(sim)
  }, [])

  const snapshot = useCallback(async (): Promise<Blob | null> => {
    const sim = simRef.current
    if (!sim || sim.w === 0) return null
    cleanDraw(sim)
    return new Promise((resolve) => {
      sim.canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  }, [])

  useImperativeHandle(ref, () => ({ scatter, snapshot }), [scatter, snapshot])

  const colors = THEME_COLORS[theme]
  const vars = {
    '--sand-glow': colors.glow,
    '--energy': clampedEnergy,
  } as CSSProperties

  const isCircle = isCirclePattern(pattern)
  const classes = [styles.canvas, isCircle && styles.circle, interactive && styles.interactive, className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={containerRef}
      className={classes}
      style={vars}
      role="img"
      aria-label={copy.sand.canvasAria(pattern.n, pattern.m, copy.sections.studio.themes[theme])}
    >
      <canvas ref={canvasRef} className={styles.surface} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <svg className={styles.grid} viewBox="0 0 100 100" aria-hidden="true">
        {isCircle ? (
          <>
            <circle cx="50" cy="50" r="48.5" className={styles.rim} />
            <circle cx="50" cy="50" r="24" strokeDasharray="1 4" />
            <line x1="50" y1="1.5" x2="50" y2="98.5" strokeDasharray="1 4" />
            <line x1="1.5" y1="50" x2="98.5" y2="50" strokeDasharray="1 4" />
          </>
        ) : (
          <>
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
          </>
        )}
        <circle cx="50" cy="50" r="0.9" className={styles.centerDot} />
      </svg>
      <span className={`mono ${styles.plateCaption}`}>{copy.sand.plateCaption}</span>
      {import.meta.env.DEV && (
        <span className={`mono ${styles.readout}`}>
          n={pattern.n} m={pattern.m} · {theme} · E={clampedEnergy.toFixed(2)} ·{' '}
          {readout.fps > 0 ? `${readout.fps}FPS` : '静态'} ·{' '}
          {readout.count ||
            Math.round((isMobileDevice() ? MOBILE_COUNT : DESKTOP_COUNT) * clampedDensity)}{' '}
          粒
        </span>
      )}
    </div>
  )
})