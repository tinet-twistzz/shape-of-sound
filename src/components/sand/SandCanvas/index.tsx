// 克拉尼驻波粒子沙盘：z(x,y) = a·cos(πnx)·cos(πmy) + b·cos(πmx)·cos(πny)，(x,y) ∈ [-1,1]²。
// 盘形边界统一用有向距离场 plateSignedDist：盘内 < 0、边缘 = 0、盘外 > 0，
// 出界粒子沿数值法线推回并温和反弹；六角/三角盘用旋转对称平面波叠加驻波场。
// 长声音压缩画法：rings 把时间切片画成同心年轮（固定圆盘），exposure 取最响瞬间叠印。
// 场查找表仅在模态变化时重建；动画循环内只做双线性插值，零对象/闭包分配。
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import {
  effectiveShape,
  evalChladniGrid,
  patternKeyOf,
  PLATE_R,
  plateSignedDist,
  SQRT3_2,
  TRI_APOTHEM,
  TRI_R,
} from '@/components/sand/chladniEval'
import { copy } from '@/content/copy'
import type { ParticleMedium, ParticleTheme, PatternParams, PlateShape } from '@/types/domain'

import styles from './SandCanvas.module.css'

export interface SandCanvasHandle {
  /** 轻撒沙粒：给所有粒子施加向外弹散的随机初速度，随后自然重聚到波节线 */
  scatter(): void
  /** 导出当前画面为带不透明底色的 PNG Blob */
  snapshot(): Promise<Blob | null>
  /** 导出缩放后的正方形 WebP 快照（展厅卡片用，默认 600×600 q0.85，Safari 自动回退 JPEG） */
  snapshotScaled(size?: number): Promise<Blob | null>
  /** 导出粒子状态：SND1 魔数 + uint32 粒数 + 每粒 Uint16 x、Uint16 y、Uint8 色桶 */
  exportState(): ArrayBuffer | null
  /** 灌入粒子状态继续仿真；格式不符返回 false */
  loadState(buffer: ArrayBuffer): boolean
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
  /** 无框铺满模式（如序厅背景）：按 max(w,h)/2 等比铺满，省略盘框、标尺网格与底栏铭文 */
  frameless?: boolean
}

const GRID = 128
const HALF_GRID = (GRID - 1) / 2
const MAX_UV = GRID - 1.0001
const DESKTOP_COUNT = 30000
const MOBILE_COUNT = 7000
const MIN_COUNT = 3000
const JITTER = 0.05
const MIGRATE = 0.004
const DAMPING = 0.86
const REST_DAMPING = 0.55
const REST_AMP = 0.012
const POINTER_RADIUS = 0.24
const POINTER_PUSH = 0.02
const HOVER_SCALE = 0.3
const CLICK_IMPULSE_RADIUS = 0.32
const CLICK_IMPULSE_PUSH = 0.055
const MIN_FRAME_DT = 14
const IDLE_SLEEP_FRAMES = 180
const IDLE_V2_THRESHOLD = 1e-7
const BG_SOLID = '#0A0C10'
const BG_TRAIL = 'rgba(10, 12, 16, 0.28)'
// 孢子拖尾更长：背景衰减更慢，保留呼吸星雾的流动余迹
const BG_TRAIL_SPORES = 'rgba(10, 12, 16, 0.16)'
const PLATE_FILL = 'rgba(232, 230, 225, 0.028)'
const PLATE_RIM = 'rgba(212, 175, 55, 0.4)'

// 四种显影介质的物理参数：阻尼 / 静摩擦 / 弹跳 / 迁移 / 切向涡流占比
const MEDIUM_PHYSICS: Record<
  ParticleMedium,
  { damping: number; restDamping: number; jitter: number; migrate: number; swirl: number }
> = {
  // 矿物细沙：高静摩擦 + 干脆波腹弹跳（原基准）
  sand: { damping: DAMPING, restDamping: REST_DAMPING, jitter: JITTER, migrate: MIGRATE, swirl: 0 },
  // 声流液银：高粘度顺滑阻尼，低随机弹跳，紧密收束于节线中心
  mercury: {
    damping: 0.78,
    restDamping: 0.42,
    jitter: JITTER * 0.3,
    migrate: MIGRATE * 1.6,
    swirl: 0,
  },
  // 织金磁丝：中等阻尼，快速落定
  filings: {
    damping: 0.8,
    restDamping: 0.45,
    jitter: JITTER * 0.55,
    migrate: MIGRATE * 1.25,
    swirl: 0,
  },
  // 极光孢子：低质量飘逸，叠加切向微涡流，定格后仍沿节线河道缓缓流淌
  spores: {
    damping: 0.94,
    restDamping: 0.82,
    jitter: JITTER * 0.7,
    migrate: MIGRATE * 0.85,
    swirl: 0.15,
  },
}

// 液银 / 磁丝 / 孢子的有效绘制上限：保性能与抑制加色过曝，超出部分只参与物理不参与笔触
const MERCURY_CAP = 9000
const FILINGS_CAP = 9000
const SPORES_CAP = 12000

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

// SVG 标尺预计算坐标：圆盘 12 等分短刻度、六角 6 轴准星与刻度、三角 3 轴准星与刻度
const CIRCLE_TICKS = Array.from({ length: 12 }, (_, k) => {
  const ang = (k * Math.PI) / 6
  const cardinal = k % 3 === 0
  const rIn = cardinal ? 44.6 : 45.6
  const rOut = 47.2
  return {
    key: k,
    x1: +(50 + rIn * Math.cos(ang)).toFixed(2),
    y1: +(50 + rIn * Math.sin(ang)).toFixed(2),
    x2: +(50 + rOut * Math.cos(ang)).toFixed(2),
    y2: +(50 + rOut * Math.sin(ang)).toFixed(2),
  }
})

const HEX_RETICLE = Array.from({ length: 6 }, (_, k) => {
  const vAng = Math.PI / 6 + (k * Math.PI) / 3
  const eAng = (k * Math.PI) / 3
  return {
    key: k,
    ax1: +(50 + 3 * Math.cos(vAng)).toFixed(2),
    ay1: +(50 + 3 * Math.sin(vAng)).toFixed(2),
    ax2: +(50 + 44.2 * Math.cos(vAng)).toFixed(2),
    ay2: +(50 + 44.2 * Math.sin(vAng)).toFixed(2),
    vx1: +(50 + 44.8 * Math.cos(vAng)).toFixed(2),
    vy1: +(50 + 44.8 * Math.sin(vAng)).toFixed(2),
    vx2: +(50 + 47.1 * Math.cos(vAng)).toFixed(2),
    vy2: +(50 + 47.1 * Math.sin(vAng)).toFixed(2),
    ex1: +(50 + 39.2 * Math.cos(eAng)).toFixed(2),
    ey1: +(50 + 39.2 * Math.sin(eAng)).toFixed(2),
    ex2: +(50 + 40.9 * Math.cos(eAng)).toFixed(2),
    ey2: +(50 + 40.9 * Math.sin(eAng)).toFixed(2),
  }
})

const TRI_RETICLE = Array.from({ length: 3 }, (_, k) => {
  const vAng = -Math.PI / 2 + (k * Math.PI * 2) / 3
  const eAng = vAng + Math.PI
  return {
    key: k,
    ax1: +(50 + 22.0 * Math.cos(eAng)).toFixed(2),
    ay1: +(50 + 22.0 * Math.sin(eAng)).toFixed(2),
    ax2: +(50 + 45.2 * Math.cos(vAng)).toFixed(2),
    ay2: +(50 + 45.2 * Math.sin(vAng)).toFixed(2),
    vx1: +(50 + 45.8 * Math.cos(vAng)).toFixed(2),
    vy1: +(50 + 45.8 * Math.sin(vAng)).toFixed(2),
    vx2: +(50 + 48.4 * Math.cos(vAng)).toFixed(2),
    vy2: +(50 + 48.4 * Math.sin(vAng)).toFixed(2),
    ex1: +(50 + 22.5 * Math.cos(eAng)).toFixed(2),
    ey1: +(50 + 22.5 * Math.sin(eAng)).toFixed(2),
    ex2: +(50 + 24.2 * Math.cos(eAng)).toFixed(2),
    ey2: +(50 + 24.2 * Math.sin(eAng)).toFixed(2),
  }
})

interface Field {
  amp: Float32Array
  dirX: Float32Array
  dirY: Float32Array
  tanX: Float32Array
  tanY: Float32Array
}

interface Sim {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  field: Field
  patternKey: string
  shape: PlateShape
  platePath: Path2D | null
  frameless: boolean
  theme: ParticleTheme
  medium: ParticleMedium
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
  rectLeft: number
  rectTop: number
  rectWidth: number
  rectHeight: number
  rectDirty: boolean
  pointer: { x: number; y: number; on: boolean; pressed: boolean }
  inView: boolean
  sleeping: boolean
  idleFrames: number
  raf: number
  last: number
  fpsEma: number
  lowMs: number
  readoutAt: number
  trailRimEnergy: number
  trailRimStyle: string
  sample: Float32Array
  boundFrame: (now: number) => void
  onReadout: (fps: number, count: number) => void
}

function buildField(pattern: PatternParams): Field {
  const size = GRID * GRID
  const rawZ = evalChladniGrid(pattern, GRID)
  const amp = new Float32Array(size)
  const dirX = new Float32Array(size)
  const dirY = new Float32Array(size)
  const tanX = new Float32Array(size)
  const tanY = new Float32Array(size)

  for (let idx = 0; idx < size; idx += 1) {
    amp[idx] = Math.abs(rawZ[idx])
  }

  // 迁移方向 = -∇amp（指向节线）；等值切向 = (-∂rawZ/∂y, ∂rawZ/∂x)（在 z=0 节线处连续不归零）
  const invStep = HALF_GRID
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

      const zx = (rawZ[j * GRID + ir] - rawZ[j * GRID + il]) * invStep * 0.5
      const zy = (rawZ[jb * GRID + i] - rawZ[jt * GRID + i]) * invStep * 0.5
      const zLen = Math.sqrt(zx * zx + zy * zy)
      if (zLen > 1e-6) {
        tanX[idx] = -zy / zLen
        tanY[idx] = zx / zLen
      }
    }
  }

  return { amp, dirX, dirY, tanX, tanY }
}

function seedRange(sim: Sim, from: number, to: number, recolor = true): void {
  const p = sim.particles
  for (let i = from; i < to; i += 1) {
    const o = i * 4
    if (sim.shape === 'circle') {
      const r = PLATE_R * Math.sqrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      p[o] = r * Math.cos(theta)
      p[o + 1] = r * Math.sin(theta)
    } else {
      // 拒绝采样：包围盒内均匀落沙，落在盘外就重撒，任意形状通用
      let x = 0
      let y = 0
      for (let tries = 0; tries < 24; tries += 1) {
        x = Math.random() * 2 - 1
        y = Math.random() * 2 - 1
        if (plateSignedDist(x, y, sim.shape) < -0.01) break
      }
      p[o] = x
      p[o + 1] = y
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
  let u = (x + 1) * HALF_GRID
  let v = (y + 1) * HALF_GRID
  if (u < 0) u = 0
  else if (u > MAX_UV) u = MAX_UV
  if (v < 0) v = 0
  else if (v > MAX_UV) v = MAX_UV
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

function sampleTangent(sim: Sim, x: number, y: number): void {
  const f = sim.field
  let u = (x + 1) * HALF_GRID
  let v = (y + 1) * HALF_GRID
  if (u < 0) u = 0
  else if (u > MAX_UV) u = MAX_UV
  if (v < 0) v = 0
  else if (v > MAX_UV) v = MAX_UV
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
  s[3] =
    f.tanX[idx] * w00 +
    f.tanX[idx + 1] * w10 +
    f.tanX[idx + GRID] * w01 +
    f.tanX[idx + GRID + 1] * w11
  s[4] =
    f.tanY[idx] * w00 +
    f.tanY[idx + 1] * w10 +
    f.tanY[idx + GRID] * w01 +
    f.tanY[idx + GRID + 1] * w11
}

function applyClickImpulse(sim: Sim, px: number, py: number): void {
  const p = sim.particles
  const active = sim.activeCount
  const r2Max = CLICK_IMPULSE_RADIUS * CLICK_IMPULSE_RADIUS
  for (let i = 0; i < active; i += 1) {
    const o = i * 4
    const dx = p[o] - px
    const dy = p[o + 1] - py
    const d2 = dx * dx + dy * dy
    if (d2 >= r2Max) continue
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2)
      const f = (CLICK_IMPULSE_PUSH * (1 - d / CLICK_IMPULSE_RADIUS)) / d
      p[o + 2] += dx * f
      p[o + 3] += dy * f
    } else {
      const ang = (i * 2.399963) % (Math.PI * 2)
      p[o + 2] += Math.cos(ang) * CLICK_IMPULSE_PUSH
      p[o + 3] += Math.sin(ang) * CLICK_IMPULSE_PUSH
    }
  }
}

function stepSim(sim: Sim): number {
  const p = sim.particles
  const bands = sim.bands
  const energy = sim.energy
  const pointer = sim.pointer
  const pointerOn = pointer.on && sim.interactive
  // 桌面悬停（on && !pressed）将排斥半径与推力降至 0.3 倍防误刮，按住拖拽释放 1.0 倍推力
  const pointerScale = pointer.pressed ? 1 : HOVER_SCALE
  const effRadius = POINTER_RADIUS * pointerScale
  const radiusSq = effRadius * effRadius
  const effPush = POINTER_PUSH * pointerScale
  const active = sim.activeCount
  const phys = MEDIUM_PHYSICS[sim.medium]
  const migrateScale = phys.migrate * 1.15
  // 孢子涡流驱动不随 amp 衰减：定格在波节线（amp≈0）后仍沿切线缓缓流淌
  const swirlDrift = phys.swirl * MIGRATE
  // voice 主题色桶在落沙时锁定，不随位置覆盖，保留不同时刻的声音色彩
  const lockBands = sim.theme === 'voice'
  let maxV2 = 0

  for (let i = 0; i < active; i += 1) {
    const o = i * 4
    let x = p[o]
    let y = p[o + 1]
    let vx = p[o + 2]
    let vy = p[o + 3]
    sampleField(sim, x, y)
    const amp = sim.sample[0]
    // 波腹处随机弹跳，强度随 amp 与 energy 缩放；波节处 amp≈0 自然安歇
    const kick = amp * energy * phys.jitter
    vx += (Math.random() - 0.5) * kick
    vy += (Math.random() - 0.5) * kick
    // 近节线幂次收束漂移力：在低振幅区维持足够恢复力，压缩节线宽度
    const pull = amp > 0 ? Math.pow(amp, 0.65) * migrateScale : 0
    vx += sim.sample[1] * pull
    vy += sim.sample[2] * pull
    if (swirlDrift > 0) {
      sampleTangent(sim, x, y)
      vx += sim.sample[3] * swirlDrift
      vy += sim.sample[4] * swirlDrift
    }
    if (pointerOn) {
      const dx = x - pointer.x
      const dy = y - pointer.y
      const d2 = dx * dx + dy * dy
      if (d2 < radiusSq && d2 > 1e-8) {
        const d = Math.sqrt(d2)
        const f = (effPush * (1 - d / effRadius)) / d
        vx += dx * f
        vy += dy * f
      }
    }
    const damp = amp < REST_AMP ? phys.restDamping : phys.damping
    vx *= damp
    vy *= damp
    x += vx
    y += vy
    // 统一 SDF 边界：出界时沿数值法线推回盘内，并沿法线温和反弹（恢复系数 0.5）
    const dist = plateSignedDist(x, y, sim.shape)
    if (dist > 0) {
      const e = 0.004
      let nx = plateSignedDist(x + e, y, sim.shape) - plateSignedDist(x - e, y, sim.shape)
      let ny = plateSignedDist(x, y + e, sim.shape) - plateSignedDist(x, y - e, sim.shape)
      const len = Math.sqrt(nx * nx + ny * ny)
      if (len > 1e-6) {
        nx /= len
        ny /= len
        x -= nx * (dist + 0.002)
        y -= ny * (dist + 0.002)
        const vn = vx * nx + vy * ny
        if (vn > 0) {
          vx -= 1.5 * vn * nx
          vy -= 1.5 * vn * ny
        }
      } else {
        x *= 0.9
        y *= 0.9
      }
    }
    p[o] = x
    p[o + 1] = y
    p[o + 2] = vx
    p[o + 3] = vy
    const v2 = vx * vx + vy * vy
    if (v2 > maxV2) maxV2 = v2
    if (!lockBands) {
      const r2 = x * x + y * y
      bands[i] = r2 < 0.36 ? 0 : r2 < 1.3 ? 1 : 2
    }
  }
  return maxV2
}

// 材质笔触的颜色批次与主题取色完全正交：voice 四桶 / neon 三环带 / 其余主题 base+bright 两批
function mediumBatchCount(theme: ParticleTheme): number {
  return theme === 'voice' ? 4 : theme === 'neon' ? 3 : 2
}

function mediumBatchColor(sim: Sim, band: number): string {
  if (sim.theme === 'voice') return VOICE_BANDS[band]
  if (sim.theme === 'neon') return NEON_BANDS[band]
  const colors = THEME_COLORS[sim.theme]
  return band === 0 ? colors.base : colors.bright
}

function inMediumBatch(sim: Sim, i: number, band: number, split: number): boolean {
  if (sim.theme === 'voice' || sim.theme === 'neon') return sim.bands[i] === band
  return band === 0 ? i < split : i >= split
}

// 声流液银：底层半透明色块 lighter 融合成连续液脉，顶层银白细芯形成金属反光脊
function drawMercury(sim: Sim, cx: number, cy: number, s: number): void {
  const { ctx, dpr, particles: p } = sim
  const count = Math.min(sim.activeCount, MERCURY_CAP)
  const split = (count * 0.7) | 0
  const batches = mediumBatchCount(sim.theme)
  const blob = 3.2 * dpr
  const blobHalf = blob / 2
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.32
  for (let band = 0; band < batches; band += 1) {
    ctx.fillStyle = mediumBatchColor(sim, band)
    for (let i = 0; i < count; i += 1) {
      if (!inMediumBatch(sim, i, band, split)) continue
      const o = i * 4
      ctx.fillRect(p[o] * s + cx - blobHalf, p[o + 1] * s + cy - blobHalf, blob, blob)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 0.78
  const core = 1.0 * dpr
  const coreHalf = core / 2
  ctx.fillStyle = 'rgba(238, 244, 250, 0.9)'
  for (let i = 0; i < count; i += 1) {
    const o = i * 4
    ctx.fillRect(p[o] * s + cx - coreHalf, p[o + 1] * s + cy - coreHalf, core, core)
  }
  ctx.globalAlpha = 1
}

// 织金磁丝：每色批单次 beginPath + moveTo/lineTo + stroke，沿带符号原场等值切线排布极细短丝
function drawFilings(sim: Sim, cx: number, cy: number, s: number): void {
  const { ctx, dpr, particles: p } = sim
  const count = Math.min(sim.activeCount, FILINGS_CAP)
  const split = (count * 0.7) | 0
  const batches = mediumBatchCount(sim.theme)
  const halfLen = 2.8 * dpr
  ctx.lineWidth = Math.max(1, 0.7 * dpr)
  ctx.lineCap = 'round'
  for (let band = 0; band < batches; band += 1) {
    ctx.strokeStyle = mediumBatchColor(sim, band)
    ctx.beginPath()
    for (let i = 0; i < count; i += 1) {
      if (!inMediumBatch(sim, i, band, split)) continue
      const o = i * 4
      const x = p[o]
      const y = p[o + 1]
      sampleTangent(sim, x, y)
      let tx = sim.sample[3]
      let ty = sim.sample[4]
      let len = Math.sqrt(tx * tx + ty * ty)
      if (len < 1e-3) {
        tx = p[o + 2]
        ty = p[o + 3]
        len = Math.sqrt(tx * tx + ty * ty)
        if (len < 1e-5) {
          tx = 0.7071
          ty = 0.7071
          len = 1
        }
      }
      tx = (tx / len) * halfLen
      ty = (ty / len) * halfLen
      const px = x * s + cx
      const py = y * s + cy
      ctx.moveTo(px - tx, py - ty)
      ctx.lineTo(px + tx, py + ty)
    }
    ctx.stroke()
  }
}

// 极光孢子：lighter 加色柔光微粒 + 稀疏星点高光，配合长拖尾呈现呼吸星雾
function drawSpores(sim: Sim, cx: number, cy: number, s: number): void {
  const { ctx, dpr, particles: p } = sim
  const count = Math.min(sim.activeCount, SPORES_CAP)
  const split = (count * 0.7) | 0
  const batches = mediumBatchCount(sim.theme)
  const glow = 2.5 * dpr
  const glowHalf = glow / 2
  ctx.globalCompositeOperation = 'lighter'
  for (let band = 0; band < batches; band += 1) {
    ctx.fillStyle = mediumBatchColor(sim, band)
    for (let i = 0; i < count; i += 1) {
      if (!inMediumBatch(sim, i, band, split)) continue
      const o = i * 4
      ctx.fillRect(p[o] * s + cx - glowHalf, p[o + 1] * s + cy - glowHalf, glow, glow)
    }
  }
  const star = 1 * dpr
  const starHalf = star / 2
  ctx.fillStyle = 'rgba(255, 250, 235, 0.9)'
  for (let i = 0; i < count; i += 6) {
    const o = i * 4
    ctx.fillRect(p[o] * s + cx - starHalf, p[o + 1] * s + cy - starHalf, star, star)
  }
  ctx.globalCompositeOperation = 'source-over'
}

function viewportScale(sim: Sim): number {
  return sim.frameless ? Math.max(sim.w, sim.h) / 2 : Math.min(sim.w, sim.h) / 2
}

function drawParticles(sim: Sim): void {
  const { ctx, w, h, activeCount: count, particles: p, dpr } = sim
  if (w === 0 || h === 0) return
  const cx = w / 2
  const cy = h / 2
  const s = viewportScale(sim)
  if (sim.medium === 'mercury') {
    drawMercury(sim, cx, cy, s)
    return
  }
  if (sim.medium === 'filings') {
    drawFilings(sim, cx, cy, s)
    return
  }
  if (sim.medium === 'spores') {
    drawSpores(sim, cx, cy, s)
    return
  }
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
          ctx.fillRect(p[o] * s + cx - fastHalf, p[o + 1] * s + cy - fastHalf, fastSize, fastSize)
        } else {
          ctx.fillRect(p[o] * s + cx - half, p[o + 1] * s + cy - half, size, size)
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
        ctx.fillRect(p[o] * s + cx - half, p[o + 1] * s + cy - half, size, size)
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
    ctx.fillRect(p[o] * s + cx - baseHalf, p[o + 1] * s + cy - baseHalf, baseSize, baseSize)
  }
  const brightSize = 1.8 * dpr
  const brightHalf = brightSize / 2
  ctx.fillStyle = colors.bright
  for (let i = split; i < count; i += 1) {
    const o = i * 4
    ctx.fillRect(p[o] * s + cx - brightHalf, p[o + 1] * s + cy - brightHalf, brightSize, brightSize)
  }
}

// 与 plateSignedDist 完全吻合的盘面轮廓，仅在换形 / resize 时重建一次
function buildPlatePath(sim: Sim): void {
  if (sim.w === 0 || sim.h === 0 || sim.frameless) {
    sim.platePath = null
    return
  }
  const s = Math.min(sim.w, sim.h) / 2
  const cx = sim.w / 2
  const cy = sim.h / 2
  const px = (x: number) => cx + x * s
  const py = (y: number) => cy + y * s
  const path = new Path2D()
  switch (sim.shape) {
    case 'circle':
      path.arc(cx, cy, PLATE_R * s, 0, Math.PI * 2)
      break
    case 'hexagon':
      for (let k = 0; k < 6; k += 1) {
        const ang = Math.PI / 6 + (k * Math.PI) / 3
        const vx = px(PLATE_R * Math.cos(ang))
        const vy = py(PLATE_R * Math.sin(ang))
        if (k === 0) path.moveTo(vx, vy)
        else path.lineTo(vx, vy)
      }
      path.closePath()
      break
    case 'triangle':
      path.moveTo(px(0), py(-TRI_R))
      path.lineTo(px(TRI_R * SQRT3_2), py(TRI_APOTHEM))
      path.lineTo(px(-TRI_R * SQRT3_2), py(TRI_APOTHEM))
      path.closePath()
      break
    default: {
      const r = PLATE_R * s
      path.rect(cx - r, cy - r, r * 2, r * 2)
    }
  }
  sim.platePath = path
}

// 静帧全量重绘时绘制微弱盘面底色与暗金外框
function drawPlate(sim: Sim): void {
  if (sim.frameless || !sim.platePath) return
  sim.ctx.fillStyle = PLATE_FILL
  sim.ctx.fill(sim.platePath)
  sim.ctx.strokeStyle = PLATE_RIM
  sim.ctx.lineWidth = Math.max(1, sim.dpr * 0.75)
  sim.ctx.stroke(sim.platePath)
}

// 拖尾帧不重复叠涂 PLATE_FILL（避免灰雾累积），仅以低 alpha 呼吸描边外框
function strokeTrailRim(sim: Sim): void {
  if (sim.frameless || !sim.platePath) return
  const qEnergy = Math.round(sim.energy * 50) / 50
  if (qEnergy !== sim.trailRimEnergy) {
    sim.trailRimEnergy = qEnergy
    sim.trailRimStyle = `rgba(212, 175, 55, ${(0.11 + qEnergy * 0.14).toFixed(3)})`
  }
  sim.ctx.strokeStyle = sim.trailRimStyle
  sim.ctx.lineWidth = Math.max(1, sim.dpr * 0.75)
  sim.ctx.stroke(sim.platePath)
}

function cleanDraw(sim: Sim): void {
  sim.ctx.fillStyle = BG_SOLID
  sim.ctx.fillRect(0, 0, sim.w, sim.h)
  drawPlate(sim)
  drawParticles(sim)
}

function trailDraw(sim: Sim): void {
  sim.ctx.fillStyle = sim.medium === 'spores' ? BG_TRAIL_SPORES : BG_TRAIL
  sim.ctx.fillRect(0, 0, sim.w, sim.h)
  strokeTrailRim(sim)
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
  return !sim.reduced && sim.inView && !document.hidden && !sim.sleeping
}

function syncRunning(sim: Sim): void {
  if (shouldRun(sim)) {
    if (sim.raf === 0) {
      sim.last = performance.now()
      sim.raf = requestAnimationFrame(sim.boundFrame)
    }
  } else if (sim.raf !== 0) {
    cancelAnimationFrame(sim.raf)
    sim.raf = 0
  }
}

function wakeSim(sim: Sim): void {
  sim.sleeping = false
  sim.idleFrames = 0
  syncRunning(sim)
}

function frame(sim: Sim, now: number): void {
  sim.raf = 0
  if (!shouldRun(sim)) return
  const dt = now - sim.last
  // 120Hz/144Hz 高刷屏锁定 ~60fps 物理步长与绘制功耗
  if (dt > 0 && dt < MIN_FRAME_DT) {
    sim.raf = requestAnimationFrame(sim.boundFrame)
    return
  }
  sim.last = now
  if (dt > 0 && dt < 1000) {
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
  const maxV2 = stepSim(sim)
  trailDraw(sim)
  if (now - sim.readoutAt > 500) {
    sim.readoutAt = now
    sim.onReadout(Math.round(sim.fpsEma), sim.activeCount)
  }
  if (sim.energy === 0 && !sim.pointer.on && sim.medium !== 'spores' && maxV2 < IDLE_V2_THRESHOLD) {
    sim.idleFrames += 1
    if (sim.idleFrames >= IDLE_SLEEP_FRAMES) {
      sim.sleeping = true
      cleanDraw(sim)
      return
    }
  } else {
    sim.idleFrames = 0
  }
  sim.raf = requestAnimationFrame(sim.boundFrame)
}

function isMobileDevice(): boolean {
  return window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches
}

export const SandCanvas = forwardRef<SandCanvasHandle, SandCanvasProps>(function SandCanvas(
  {
    pattern,
    theme,
    energy,
    interactive = false,
    className,
    density = 1,
    activeColorBand = 1,
    frameless = false,
  },
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
    frameless,
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
      shape: effectiveShape(init.pattern),
      platePath: null,
      frameless: init.frameless,
      theme: init.theme,
      medium: init.pattern.medium ?? 'sand',
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
      rectLeft: 0,
      rectTop: 0,
      rectWidth: 0,
      rectHeight: 0,
      rectDirty: true,
      pointer: { x: 0, y: 0, on: false, pressed: false },
      inView: true,
      sleeping: false,
      idleFrames: 0,
      raf: 0,
      last: 0,
      fpsEma: 0,
      lowMs: 0,
      readoutAt: 0,
      trailRimEnergy: -1,
      trailRimStyle: 'rgba(212, 175, 55, 0.120)',
      sample: new Float32Array(5),
      boundFrame: () => undefined,
      onReadout: import.meta.env.DEV ? (fps, count) => setReadout({ fps, count }) : () => undefined,
    }
    sim.boundFrame = (t: number) => frame(sim, t)
    simRef.current = sim
    seedRange(sim, 0, sim.count)

    const refreshRect = () => {
      const rect = container.getBoundingClientRect()
      sim.rectLeft = rect.left
      sim.rectTop = rect.top
      sim.rectWidth = rect.width
      sim.rectHeight = rect.height
      sim.rectDirty = false
      return rect
    }

    const resize = () => {
      const rect = refreshRect()
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
      buildPlatePath(sim)
      if (sim.reduced) settle(sim)
      else cleanDraw(sim)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const markRectDirty = () => {
      sim.rectDirty = true
    }
    window.addEventListener('scroll', markRectDirty, { passive: true })

    const intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      sim.inView = entry.isIntersecting
      sim.rectDirty = true
      syncRunning(sim)
    })
    intersectionObserver.observe(container)

    const onVisibility = () => syncRunning(sim)
    document.addEventListener('visibilitychange', onVisibility)

    const mapPointer = (event: PointerEvent): boolean => {
      if (sim.rectDirty || sim.rectWidth === 0 || sim.rectHeight === 0) {
        refreshRect()
      }
      const rw = sim.rectWidth
      const rh = sim.rectHeight
      if (rw === 0 || rh === 0) return false
      const s = sim.frameless ? Math.max(rw, rh) / 2 : Math.min(rw, rh) / 2
      sim.pointer.x = (event.clientX - sim.rectLeft - rw / 2) / s
      sim.pointer.y = (event.clientY - sim.rectTop - rh / 2) / s
      return true
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!sim.interactive) return
      sim.rectDirty = true
      if (!mapPointer(event)) return
      sim.pointer.on = true
      sim.pointer.pressed = true
      applyClickImpulse(sim, sim.pointer.x, sim.pointer.y)
      if (sim.reduced) settle(sim)
      else wakeSim(sim)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!sim.interactive) return
      if (!mapPointer(event)) return
      sim.pointer.on = true
      if (!sim.reduced) wakeSim(sim)
    }

    const onPointerUp = (event: PointerEvent) => {
      sim.pointer.pressed = false
      if (event.pointerType !== 'mouse') {
        sim.pointer.on = false
      }
    }

    const clearPointer = () => {
      sim.pointer.on = false
      sim.pointer.pressed = false
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointerleave', clearPointer)
    container.addEventListener('pointercancel', clearPointer)

    if (sim.reduced) settle(sim)
    else syncRunning(sim)

    return () => {
      if (sim.raf !== 0) cancelAnimationFrame(sim.raf)
      sim.raf = 0
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      window.removeEventListener('scroll', markRectDirty)
      document.removeEventListener('visibilitychange', onVisibility)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointerleave', clearPointer)
      container.removeEventListener('pointercancel', clearPointer)
      simRef.current = null
    }
  }, [])

  useEffect(() => {
    const sim = simRef.current
    if (!sim || sim.frameless === frameless) return
    sim.frameless = frameless
    buildPlatePath(sim)
    cleanDraw(sim)
  }, [frameless])

  useEffect(() => {
    const sim = simRef.current
    if (!sim || sim.patternKey === key) return
    sim.patternKey = key
    sim.medium = pattern.medium ?? 'sand'
    sim.field = buildField(pattern)
    const shape = effectiveShape(pattern)
    const shapeChanged = shape !== sim.shape
    if (shapeChanged) {
      sim.shape = shape
      buildPlatePath(sim)
      seedParticles(sim)
    }
    if (sim.reduced) settle(sim)
    else {
      // 盘形未变时不清屏重绘：保留粒子游向新波节线的自然拖尾，避免逐帧 cleanDraw 闪烁
      if (shapeChanged) cleanDraw(sim)
      wakeSim(sim)
    }
  }, [key, pattern])

  useEffect(() => {
    const sim = simRef.current
    if (!sim || sim.theme === theme) return
    sim.theme = theme
    // 切入彩沙时以当前色桶为底色重新落沙，之后新粒随 density 增长带入新色
    if (theme === 'voice') sim.bands.fill(sim.activeColorBand, 0, sim.count)
    cleanDraw(sim)
    wakeSim(sim)
  }, [theme])

  useEffect(() => {
    const sim = simRef.current
    if (!sim || sim.density === clampedDensity) return
    const prev = sim.activeCount
    sim.density = clampedDensity
    sim.activeCount = Math.round(sim.count * clampedDensity)
    if (sim.activeCount > prev) seedRange(sim, prev, sim.activeCount)
    if (sim.reduced) settle(sim)
    else wakeSim(sim)
  }, [clampedDensity])

  useEffect(() => {
    const sim = simRef.current
    // 只更新当前色桶，不回写已落沙粒的颜色，保留彩沙记忆
    if (sim) sim.activeColorBand = activeColorBand
  }, [activeColorBand])

  useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    sim.energy = clampedEnergy
    if (clampedEnergy > 0 && !sim.reduced) wakeSim(sim)
  }, [clampedEnergy])

  useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    sim.interactive = interactive
    if (!interactive) {
      sim.pointer.on = false
      sim.pointer.pressed = false
    }
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
    else wakeSim(sim)
  }, [])

  const snapshot = useCallback(async (): Promise<Blob | null> => {
    const sim = simRef.current
    if (!sim || sim.w === 0) return null
    cleanDraw(sim)
    return new Promise((resolve) => {
      sim.canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  }, [])

  const snapshotScaled = useCallback(async (size = 600): Promise<Blob | null> => {
    const sim = simRef.current
    if (!sim || sim.w === 0 || sim.h === 0) return null
    cleanDraw(sim)
    const off = document.createElement('canvas')
    off.width = size
    off.height = size
    const ctx = off.getContext('2d')
    if (!ctx) return null
    const side = Math.min(sim.w, sim.h)
    const sx = (sim.w - side) / 2
    const sy = (sim.h - side) / 2
    ctx.drawImage(sim.canvas, sx, sy, side, side, 0, 0, size, size)
    return new Promise((resolve) => {
      off.toBlob(
        (webpBlob) => {
          if (webpBlob && webpBlob.type === 'image/webp') {
            resolve(webpBlob)
            return
          }
          // 旧版 Safari 不支持 WebP 时回退为高画质有损 JPEG，避免 PNG 超出后端 300KB 限制
          off.toBlob((jpegBlob) => resolve(jpegBlob ?? webpBlob), 'image/jpeg', 0.85)
        },
        'image/webp',
        0.85,
      )
    })
  }, [])

  const exportState = useCallback((): ArrayBuffer | null => {
    const sim = simRef.current
    if (!sim) return null
    const n = sim.activeCount
    const buffer = new ArrayBuffer(8 + n * 5)
    const bytes = new Uint8Array(buffer)
    const view = new DataView(buffer)
    bytes[0] = 0x53
    bytes[1] = 0x4e
    bytes[2] = 0x44
    bytes[3] = 0x31
    view.setUint32(4, n, true)
    const p = sim.particles
    for (let i = 0; i < n; i += 1) {
      const o = i * 4
      const qx = Math.max(0, Math.min(65535, Math.round(((p[o] + 1) / 2) * 65535)))
      const qy = Math.max(0, Math.min(65535, Math.round(((p[o + 1] + 1) / 2) * 65535)))
      view.setUint16(8 + i * 5, qx, true)
      view.setUint16(10 + i * 5, qy, true)
      bytes[12 + i * 5] = sim.bands[i]
    }
    return buffer
  }, [])

  const loadState = useCallback((buffer: ArrayBuffer): boolean => {
    const sim = simRef.current
    if (!sim || buffer.byteLength < 8) return false
    const bytes = new Uint8Array(buffer)
    if (bytes[0] !== 0x53 || bytes[1] !== 0x4e || bytes[2] !== 0x44 || bytes[3] !== 0x31)
      return false
    const view = new DataView(buffer)
    const rawCount = view.getUint32(4, true)
    if (rawCount < 1 || rawCount > DESKTOP_COUNT || buffer.byteLength !== 8 + rawCount * 5) {
      return false
    }
    const maxCount = isMobileDevice() ? MOBILE_COUNT : DESKTOP_COUNT
    const targetCount = Math.min(rawCount, maxCount)
    const stride = rawCount / targetCount
    const p = sim.particles
    for (let i = 0; i < targetCount; i += 1) {
      const src = targetCount === rawCount ? i : Math.min(rawCount - 1, Math.floor(i * stride))
      const o = i * 4
      p[o] = (view.getUint16(8 + src * 5, true) / 65535) * 2 - 1
      p[o + 1] = (view.getUint16(10 + src * 5, true) / 65535) * 2 - 1
      p[o + 2] = 0
      p[o + 3] = 0
      sim.bands[i] = bytes[12 + src * 5] & 3
    }
    sim.count = targetCount
    sim.density = 1
    sim.activeCount = targetCount
    if (sim.reduced) settle(sim)
    else {
      cleanDraw(sim)
      wakeSim(sim)
    }
    return true
  }, [])

  useImperativeHandle(ref, () => ({ scatter, snapshot, snapshotScaled, exportState, loadState }), [
    scatter,
    snapshot,
    snapshotScaled,
    exportState,
    loadState,
  ])

  const colors = THEME_COLORS[theme]
  const vars = {
    '--sand-glow': colors.glow,
    '--energy': clampedEnergy,
  } as CSSProperties

  const shape = effectiveShape(pattern)
  const classes = [
    styles.canvas,
    shape === 'circle' && !frameless && styles.circle,
    frameless && styles.frameless,
    interactive && styles.interactive,
    className,
  ]
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
      {!frameless && (
        <svg className={styles.grid} viewBox="0 0 100 100" aria-hidden="true">
          {shape === 'circle' ? (
            <>
              <circle cx="50" cy="50" r="24" strokeDasharray="1 4" />
              <line x1="50" y1="3" x2="50" y2="97" strokeDasharray="1 4" />
              <line x1="3" y1="50" x2="97" y2="50" strokeDasharray="1 4" />
              {CIRCLE_TICKS.map((t) => (
                <line
                  key={t.key}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  className={styles.corner}
                />
              ))}
            </>
          ) : shape === 'square' ? (
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
          ) : shape === 'hexagon' ? (
            <>
              {HEX_RETICLE.map((r) => (
                <g key={r.key}>
                  <line x1={r.ax1} y1={r.ay1} x2={r.ax2} y2={r.ay2} strokeDasharray="1 4" />
                  <line x1={r.vx1} y1={r.vy1} x2={r.vx2} y2={r.vy2} className={styles.corner} />
                  <line x1={r.ex1} y1={r.ey1} x2={r.ex2} y2={r.ey2} />
                </g>
              ))}
            </>
          ) : (
            <>
              {TRI_RETICLE.map((r) => (
                <g key={r.key}>
                  <line x1={r.ax1} y1={r.ay1} x2={r.ax2} y2={r.ay2} strokeDasharray="1 4" />
                  <line x1={r.vx1} y1={r.vy1} x2={r.vx2} y2={r.vy2} className={styles.corner} />
                  <line x1={r.ex1} y1={r.ey1} x2={r.ex2} y2={r.ey2} />
                </g>
              ))}
            </>
          )}
          <circle cx="50" cy="50" r="0.9" className={styles.centerDot} />
        </svg>
      )}
      {!frameless && (
        <span className={`mono ${styles.plateCaption}`}>{copy.sand.plateCaption}</span>
      )}
      {import.meta.env.DEV && !frameless && (
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
