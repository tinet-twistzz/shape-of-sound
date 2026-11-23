// 克拉尼驻波零依赖纯数学求值模块：有向距离场、参数签名键与带符号标量驻波场 z(x, y)。
// 同时服务于 SandCanvas（物理场中央差分梯度与等值切线）与 PatternThumbnail（同构静帧显影）。
import type { PatternParams, PlateShape } from '@/types/domain'

export const PLATE_R = 0.95
export const SQRT3_2 = Math.sqrt(3) / 2
export const HEX_APOTHEM = PLATE_R * SQRT3_2
export const TRI_R = 0.98
export const TRI_APOTHEM = TRI_R / 2

type TimelineSlice = NonNullable<PatternParams['timelineSlices']>[number]

interface ExposureLayer {
  n: number
  m: number
  a: number
  b: number
  w: number
}

export interface PreparedChladni {
  shape: PlateShape
  norm: number
  evalZ: (x: number, y: number) => number
}

/** 声音年轮固定按圆盘处理；其余模式（含多重曝光）严格服从所选盘形 */
export function effectiveShape(pattern: PatternParams): PlateShape {
  if (pattern.compressionMode === 'rings') return 'circle'
  return pattern.plateShape ?? 'square'
}

/**
 * 统一有向距离场：盘内 < 0、边缘 = 0、盘外 > 0。
 * 四种盘形的半平面法向量均严格归一化（|∇d| = 1），距离值可直接换算为像素距离。
 */
export function plateSignedDist(x: number, y: number, shape: PlateShape): number {
  switch (shape) {
    case 'circle':
      return Math.sqrt(x * x + y * y) - PLATE_R
    case 'hexagon':
      return (
        Math.max(Math.abs(x), Math.abs(0.5 * x + SQRT3_2 * y), Math.abs(0.5 * x - SQRT3_2 * y)) -
        HEX_APOTHEM
      )
    case 'triangle':
      return Math.max(y, -SQRT3_2 * x - 0.5 * y, SQRT3_2 * x - 0.5 * y) - TRI_APOTHEM
    default:
      return Math.max(Math.abs(x), Math.abs(y)) - PLATE_R
  }
}

export function patternKeyOf(pattern: PatternParams): string {
  const sec = pattern.secondary
  const secKey = sec ? `${sec.n}.${sec.m}.${sec.weight}` : '0'
  const slices = pattern.timelineSlices
  const sliceKey = slices
    ? slices.map((s) => `${s.n}.${s.m}.${s.a}.${s.b}.${s.weight}`).join('|')
    : '0'
  return `${pattern.n}-${pattern.m}-${pattern.a ?? 0}-${pattern.b ?? 0}-${pattern.plateShape ?? 'square'}-${secKey}-${pattern.compressionMode ?? 'live'}-${sliceKey}-${(pattern.twist ?? 0).toFixed(2)}-${pattern.medium ?? 'sand'}`
}

function ringSliceZ(slice: TimelineSlice, r: number, theta: number): number {
  const loud = 0.35 + 0.65 * slice.weight
  return Math.cos(Math.PI * slice.m * r) * (slice.a * Math.cos(slice.n * theta) + slice.b) * loud
}

function evalRingsAt(slices: TimelineSlice[], x: number, y: number): number {
  const r = Math.sqrt(x * x + y * y)
  if (r > 1.02) return 0
  const theta = Math.atan2(y, x)
  const k = slices.length
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
  return z0 + (z1 - z0) * t
}

function buildExposureLayers(slices: TimelineSlice[]): ExposureLayer[] {
  const sorted = [...slices].sort((p, q) => q.weight - p.weight)
  const top = sorted.slice(0, 3).filter((s, idx) => idx === 0 || s.weight >= sorted[0].weight * 0.3)
  let wSum = 0
  for (const s of top) wSum += s.weight
  return top.map((s) => {
    const n = Math.max(1, Math.round(s.n))
    const m = Math.max(1, Math.round(s.m))
    let b = s.b
    if (n === m && s.a + b === 0) b = 1
    return {
      n,
      m,
      a: s.a,
      b,
      w: wSum > 0 ? (s.weight / wSum) * 1.8 : 1.8 / top.length,
    }
  })
}

function normalizeBaseParams(pattern: PatternParams) {
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
  const sign2 = n2 === m2 ? 1 : -1
  const twist = pattern.twist ?? 0
  return { n, m, a, b, hasSec: Boolean(sec && w2 !== 0), n2, m2, w2, sign2, twist }
}

/** 预编译标量求值器及归一化幅度尺度，供任意坐标单点求值或缩略图显影使用 */
export function prepareChladni(pattern: PatternParams): PreparedChladni {
  const shape = effectiveShape(pattern)
  const slices = pattern.timelineSlices

  if (pattern.compressionMode === 'rings' && slices && slices.length > 0) {
    let sumPeak = 0
    for (const s of slices) {
      sumPeak += (Math.abs(s.a) + Math.abs(s.b)) * (0.35 + 0.65 * s.weight)
    }
    const norm = Math.max(0.6, sumPeak / slices.length)
    return {
      shape,
      norm,
      evalZ: (x, y) => evalRingsAt(slices, x, y),
    }
  }

  if (pattern.compressionMode === 'exposure' && slices && slices.length > 0) {
    const layers = buildExposureLayers(slices)
    let sumAmp = 0
    for (const l of layers) {
      sumAmp += l.w * (Math.abs(l.a) + Math.abs(l.b))
    }
    const norm = Math.max(0.8, layers.length > 1 ? sumAmp * 0.78 : sumAmp)
    return {
      shape,
      norm,
      evalZ: (x, y) => {
        let z = 0
        for (let l = 0; l < layers.length; l += 1) {
          const { n, m, a, b, w } = layers[l]
          z +=
            w *
            (a * Math.cos(Math.PI * n * x) * Math.cos(Math.PI * m * y) +
              b * Math.cos(Math.PI * m * x) * Math.cos(Math.PI * n * y))
        }
        return z
      },
    }
  }

  const { n, m, a, b, hasSec, n2, m2, w2, sign2, twist } = normalizeBaseParams(pattern)
  const baseAmp = Math.abs(a) + Math.abs(b) || 1

  if (shape === 'circle') {
    const norm = baseAmp * (1 + (hasSec ? Math.abs(w2) * 0.75 : 0))
    return {
      shape,
      norm,
      evalZ: (x, y) => {
        const r = Math.sqrt(x * x + y * y)
        if (r > 1.02) return 0
        const theta = Math.atan2(y, x) + twist * 0.85 * r
        let z = Math.cos(Math.PI * m * r) * (a * Math.cos(n * theta) + b)
        if (hasSec) {
          z += w2 * Math.cos(Math.PI * m2 * r) * (a * Math.cos(n2 * theta) + b)
        }
        return z
      },
    }
  }

  if (shape === 'hexagon' || shape === 'triangle') {
    const triangle = shape === 'triangle'
    const phi = twist * 0.6
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    const kN = Math.PI * n
    const kM = Math.PI * m
    const kN2 = Math.PI * n2
    const kM2 = Math.PI * m2
    const norm = baseAmp * 0.78 * (1 + (hasSec ? Math.abs(w2) * 0.75 : 0))
    return {
      shape,
      norm,
      evalZ: (x, y) => {
        const rx = twist !== 0 ? x * cp - y * sp : x
        const ry = twist !== 0 ? x * sp + y * cp : y
        const u = triangle ? ry : rx
        const v = triangle ? rx : ry
        const zn = Math.cos(kN * u) + 2 * Math.cos((kN * u) / 2) * Math.cos(kN * SQRT3_2 * v)
        const zm = Math.cos(kM * u) + 2 * Math.cos((kM * u) / 2) * Math.cos(kM * SQRT3_2 * v)
        let z = a * zn + b * zm
        if (hasSec) {
          const zn2 = Math.cos(kN2 * u) + 2 * Math.cos((kN2 * u) / 2) * Math.cos(kN2 * SQRT3_2 * v)
          const zm2 = Math.cos(kM2 * u) + 2 * Math.cos((kM2 * u) / 2) * Math.cos(kM2 * SQRT3_2 * v)
          z += w2 * (a * zn2 + b * zm2)
        }
        return z / 3
      },
    }
  }

  const kN = Math.PI * n
  const kM = Math.PI * m
  const kN2 = Math.PI * n2
  const kM2 = Math.PI * m2
  const norm = baseAmp + (hasSec ? Math.abs(w2) * 1.4 : 0) + Math.abs(twist) * 0.5
  return {
    shape,
    norm,
    evalZ: (x, y) => {
      let z = a * Math.cos(kN * x) * Math.cos(kM * y) + b * Math.cos(kM * x) * Math.cos(kN * y)
      if (hasSec) {
        z +=
          w2 *
          (Math.cos(kN2 * x) * Math.cos(kM2 * y) + sign2 * Math.cos(kM2 * x) * Math.cos(kN2 * y))
      }
      if (twist !== 0) {
        z += twist * (Math.sin(kN * x) * Math.sin(kM * y) - Math.sin(kM * x) * Math.sin(kN * y))
      }
      return z
    },
  }
}

/** 单点标量驻波值 z(x, y)（带符号） */
export function evalChladniZ(pattern: PatternParams, x: number, y: number): number {
  return prepareChladni(pattern).evalZ(x, y)
}

/**
 * 在 [-1, 1]² 均匀网格上批量求取带符号原场 rawZ（gridSize × gridSize）。
 * 可分离模态自动走一维余弦查找表加速，边界外保持平滑延拓以消除差分伪影。
 */
export function evalChladniGrid(
  pattern: PatternParams,
  gridSize: number,
  out?: Float32Array,
): Float32Array {
  const rawZ =
    out && out.length >= gridSize * gridSize ? out : new Float32Array(gridSize * gridSize)
  if (out) rawZ.fill(0, 0, gridSize * gridSize)
  const denom = Math.max(1, gridSize - 1)
  const shape = effectiveShape(pattern)
  const slices = pattern.timelineSlices

  if (pattern.compressionMode === 'rings' && slices && slices.length > 0) {
    for (let j = 0; j < gridSize; j += 1) {
      const y = -1 + (2 * j) / denom
      for (let i = 0; i < gridSize; i += 1) {
        const x = -1 + (2 * i) / denom
        rawZ[j * gridSize + i] = evalRingsAt(slices, x, y)
      }
    }
    return rawZ
  }

  if (pattern.compressionMode === 'exposure' && slices && slices.length > 0) {
    const layers = buildExposureLayers(slices)
    const cosN = layers.map(() => new Float32Array(gridSize))
    const cosM = layers.map(() => new Float32Array(gridSize))
    for (let i = 0; i < gridSize; i += 1) {
      const t = -1 + (2 * i) / denom
      for (let l = 0; l < layers.length; l += 1) {
        cosN[l][i] = Math.cos(Math.PI * layers[l].n * t)
        cosM[l][i] = Math.cos(Math.PI * layers[l].m * t)
      }
    }
    for (let j = 0; j < gridSize; j += 1) {
      const row = j * gridSize
      for (let i = 0; i < gridSize; i += 1) {
        let z = 0
        for (let l = 0; l < layers.length; l += 1) {
          const { a, b, w } = layers[l]
          z += w * (a * cosN[l][i] * cosM[l][j] + b * cosM[l][i] * cosN[l][j])
        }
        rawZ[row + i] = z
      }
    }
    return rawZ
  }

  const { n, m, a, b, hasSec, n2, m2, w2, sign2, twist } = normalizeBaseParams(pattern)

  if (shape === 'circle') {
    for (let j = 0; j < gridSize; j += 1) {
      const y = -1 + (2 * j) / denom
      const row = j * gridSize
      for (let i = 0; i < gridSize; i += 1) {
        const x = -1 + (2 * i) / denom
        const r = Math.sqrt(x * x + y * y)
        if (r > 1.02) continue
        const theta = Math.atan2(y, x) + twist * 0.85 * r
        let z = Math.cos(Math.PI * m * r) * (a * Math.cos(n * theta) + b)
        if (hasSec) {
          z += w2 * Math.cos(Math.PI * m2 * r) * (a * Math.cos(n2 * theta) + b)
        }
        rawZ[row + i] = z
      }
    }
    return rawZ
  }

  if (shape === 'hexagon' || shape === 'triangle') {
    const triangle = shape === 'triangle'
    if (twist !== 0) {
      const { evalZ } = prepareChladni(pattern)
      for (let j = 0; j < gridSize; j += 1) {
        const y = -1 + (2 * j) / denom
        const row = j * gridSize
        for (let i = 0; i < gridSize; i += 1) {
          const x = -1 + (2 * i) / denom
          rawZ[row + i] = evalZ(x, y)
        }
      }
      return rawZ
    }
    const freqs = hasSec ? [n, m, n2, m2] : [n, m]
    const cu = freqs.map(() => new Float32Array(gridSize))
    const ch = freqs.map(() => new Float32Array(gridSize))
    const cv = freqs.map(() => new Float32Array(gridSize))
    for (let i = 0; i < gridSize; i += 1) {
      const t = -1 + (2 * i) / denom
      for (let f = 0; f < freqs.length; f += 1) {
        const k = Math.PI * freqs[f]
        cu[f][i] = Math.cos(k * t)
        ch[f][i] = Math.cos((k * t) / 2)
        cv[f][i] = Math.cos(k * SQRT3_2 * t)
      }
    }
    for (let j = 0; j < gridSize; j += 1) {
      const row = j * gridSize
      for (let i = 0; i < gridSize; i += 1) {
        const ui = triangle ? j : i
        const vi = triangle ? i : j
        const zn = cu[0][ui] + 2 * ch[0][ui] * cv[0][vi]
        const zm = cu[1][ui] + 2 * ch[1][ui] * cv[1][vi]
        let z = a * zn + b * zm
        if (hasSec) {
          const zn2 = cu[2][ui] + 2 * ch[2][ui] * cv[2][vi]
          const zm2 = cu[3][ui] + 2 * ch[3][ui] * cv[3][vi]
          z += w2 * (a * zn2 + b * zm2)
        }
        rawZ[row + i] = z / 3
      }
    }
    return rawZ
  }

  // 方盘：正交驻波叠加（含副模态与反对称扭转奇函数项）
  const cosN = new Float32Array(gridSize)
  const cosM = new Float32Array(gridSize)
  const cosN2 = hasSec ? new Float32Array(gridSize) : null
  const cosM2 = hasSec ? new Float32Array(gridSize) : null
  const sinN = twist !== 0 ? new Float32Array(gridSize) : null
  const sinM = twist !== 0 ? new Float32Array(gridSize) : null
  for (let i = 0; i < gridSize; i += 1) {
    const t = -1 + (2 * i) / denom
    cosN[i] = Math.cos(Math.PI * n * t)
    cosM[i] = Math.cos(Math.PI * m * t)
    if (cosN2 && cosM2) {
      cosN2[i] = Math.cos(Math.PI * n2 * t)
      cosM2[i] = Math.cos(Math.PI * m2 * t)
    }
    if (sinN && sinM) {
      sinN[i] = Math.sin(Math.PI * n * t)
      sinM[i] = Math.sin(Math.PI * m * t)
    }
  }
  for (let j = 0; j < gridSize; j += 1) {
    const row = j * gridSize
    for (let i = 0; i < gridSize; i += 1) {
      let z = a * cosN[i] * cosM[j] + b * cosM[i] * cosN[j]
      if (cosN2 && cosM2) {
        z += w2 * (cosN2[i] * cosM2[j] + sign2 * cosM2[i] * cosN2[j])
      }
      if (sinN && sinM) {
        z += twist * (sinN[i] * sinM[j] - sinM[i] * sinN[j])
      }
      rawZ[row + i] = z
    }
  }
  return rawZ
}
