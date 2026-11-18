import { copy } from '@/content/copy'
import type { PatternParams } from '@/types/domain'

export interface UtteranceSample {
  pitchHz: number | null
  volume: number
  brightness: number
}

export interface UtteranceResult {
  pattern: PatternParams
  /** 定格后的星尘余振能量：说话越响，余振越明显 */
  energy: number
  report: string
}

const r = copy.sections.studio.utteranceReport

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** 音量顿挫次数：带迟滞的起落检测，短于 4 帧（约 66ms）的毛刺不计 */
function countRhythmBursts(samples: UtteranceSample[]): number {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, s.volume)
  if (peak < 0.08) return 0
  const onThreshold = peak * 0.45
  const offThreshold = peak * 0.2
  let active = false
  let start = 0
  let count = 0
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i].volume
    if (!active && v > onThreshold) {
      active = true
      start = i
    } else if (active && v < offThreshold) {
      active = false
      if (i - start >= 4) count += 1
    }
  }
  if (active && samples.length - start >= 4) count += 1
  return count
}

/** 从约 2.5 秒的一句话里提取 4 个特征，合成专属图案与人话版小报告 */
export function analyzeUtterance(
  samples: UtteranceSample[],
  mapPitch: (hz: number) => PatternParams,
): UtteranceResult {
  const pitches: number[] = []
  let loudSum = 0
  let loudCount = 0
  let brightSum = 0
  let brightWeight = 0
  for (const s of samples) {
    if (s.pitchHz !== null) pitches.push(s.pitchHz)
    if (s.volume > 0.05) {
      loudSum += s.volume
      loudCount += 1
      brightSum += s.brightness * s.volume
      brightWeight += s.volume
    }
  }

  if (pitches.length < 5) {
    return { pattern: { ...mapPitch(220), a: 1, b: -0.8 }, energy: 0.15, report: r.silent }
  }

  // ① 平均音高 → 基础线条疏密
  let pitchSum = 0
  let pitchMin = Infinity
  let pitchMax = -Infinity
  for (const p of pitches) {
    pitchSum += p
    pitchMin = Math.min(pitchMin, p)
    pitchMax = Math.max(pitchMax, p)
  }
  const base = mapPitch(pitchSum / pitches.length)

  // ② 音色明亮度 → 花瓣胖瘦与开合
  const brightness = brightWeight > 0 ? brightSum / brightWeight : 0.4
  const b = -(0.35 + clamp01(brightness) * 1.1)

  // ③ 语气起伏 + 节奏顿挫 → 第二层叠纹
  const range = pitchMax - pitchMin
  const bursts = countRhythmBursts(samples)
  const strength = clamp01(range / 160) * 0.7 + clamp01(bursts / 6) * 0.3
  let secondary: PatternParams['secondary']
  if (strength >= 0.25) {
    const delta = 1 + Math.round(strength * 2)
    const n2 = base.m
    let m2 = base.n + delta
    if (n2 === m2) m2 += 1
    secondary = { n: n2, m: m2, weight: 0.25 + 0.5 * strength }
  }

  // ④ 说话响度 → 聚拢后的星尘余振
  const loudness = loudCount > 0 ? loudSum / loudCount : 0
  const energy = 0.08 + 0.35 * clamp01(loudness * 1.8)

  const parts = [
    brightness < 0.3 ? r.brightLow : brightness < 0.6 ? r.brightMid : r.brightHigh,
    range < 40 ? r.rangeCalm : range < 100 ? r.rangeSome : r.rangeBig,
    r.rhythm(bursts),
    loudness < 0.12 ? r.volumeLow : loudness < 0.35 ? r.volumeMid : r.volumeHigh,
  ]
  if (secondary) parts.push(r.layered)

  return { pattern: { ...base, a: 1, b, secondary }, energy, report: parts.join(' · ') }
}