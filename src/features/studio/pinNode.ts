import type { PlateShape } from '@/types/domain'

import { bToTimbre, TIMBRE_B_SPAN } from './timbreMeta'

const SQRT3_2 = Math.sqrt(3) / 2

/** 主模态在 (x, y) 处的驻波值（与 SandCanvas.buildField 主项逐式对齐，不含 secondary） */
function mainBasis(
  x: number,
  y: number,
  n: number,
  m: number,
  b: number,
  shape: PlateShape,
  twist: number,
): number {
  if (shape === 'circle') {
    const r = Math.sqrt(x * x + y * y)
    const theta = Math.atan2(y, x) + twist * 0.85 * r
    return Math.cos(Math.PI * m * r) * (Math.cos(n * theta) + b)
  }
  if (shape === 'hexagon' || shape === 'triangle') {
    const phi = twist * 0.6
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    const rx = x * cp - y * sp
    const ry = x * sp + y * cp
    const u = shape === 'triangle' ? ry : rx
    const v = shape === 'triangle' ? rx : ry
    const kN = Math.PI * n
    const kM = Math.PI * m
    const zn = Math.cos(kN * u) + 2 * Math.cos((kN * u) / 2) * Math.cos(kN * SQRT3_2 * v)
    const zm = Math.cos(kM * u) + 2 * Math.cos((kM * u) / 2) * Math.cos(kM * SQRT3_2 * v)
    return zn + b * zm
  }
  return (
    Math.cos(Math.PI * n * x) * Math.cos(Math.PI * m * y) +
    b * Math.cos(Math.PI * m * x) * Math.cos(Math.PI * n * y) +
    twist *
      (Math.sin(Math.PI * n * x) * Math.sin(Math.PI * m * y) -
        Math.sin(Math.PI * m * x) * Math.sin(Math.PI * n * y))
  )
}

/**
 * 指尖制音反算：主模态对 b 线性，两次求值即解 a·f₁ + b·f₂ = 0（a = 1）。
 * 返回钳制到滑杆量程的 b；该点对 b 不敏感（已是波节或波腹锁定）时返回 null。
 */
export function solvePinB(
  x: number,
  y: number,
  n: number,
  m: number,
  shape: PlateShape,
  twist: number,
): number | null {
  const z0 = mainBasis(x, y, n, m, 0, shape, twist)
  const z1 = mainBasis(x, y, n, m, 1, shape, twist)
  const denom = z1 - z0
  if (Math.abs(denom) < 1e-4) return null
  const b = -z0 / denom
  return Math.min(TIMBRE_B_SPAN, Math.max(-TIMBRE_B_SPAN, b))
}

/** 反解并换算成「音色形态」滑杆读数（扣除大三度档的正相偏移） */
export function solvePinTimbre(
  x: number,
  y: number,
  n: number,
  m: number,
  shape: PlateShape,
  twist: number,
  bOffset: number,
): number | null {
  const b = solvePinB(x, y, n, m, shape, twist)
  if (b === null) return null
  return bToTimbre(b - bOffset)
}