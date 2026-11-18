import { copy } from '@/content/copy'
import { centroidToB } from '@/services/real/chladniPatternMapper'
import type { PatternParams } from '@/types/domain'

export interface UtteranceSample {
  pitchHz: number | null
  volume: number
  brightness: number
  centroid?: number
  harmonicRatio?: number
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

function round2(value: number): number {
  return Math.round(value * 100) / 100
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

/** 语调滑音斜率与起伏 → 反对称扭转度：平稳语调接近 0，抑扬转音激发非零 twist */
function computeTwist(samples: UtteranceSample[], pitches: number[]): number {
  let slopeSum = 0
  let absSum = 0
  let slopeCount = 0
  for (let i = 1; i < samples.length; i += 1) {
    const p0 = samples[i - 1].pitchHz
    const p1 = samples[i].pitchHz
    if (p0 === null || p1 === null) continue
    if (samples[i - 1].volume <= 0.05 || samples[i].volume <= 0.05) continue
    const d = p1 - p0
    slopeSum += d
    absSum += Math.abs(d)
    slopeCount += 1
  }
  if (slopeCount < 4) return 0
  const meanSlope = slopeSum / slopeCount
  const jitter = absSum / slopeCount
  const half = Math.floor(pitches.length / 2)
  let early = 0
  let late = 0
  for (let i = 0; i < half; i += 1) early += pitches[i]
  for (let i = half; i < pitches.length; i += 1) late += pitches[i]
  const direction = Math.sign(late / (pitches.length - half) - early / half) || 1
  const glide = Math.min(1, Math.max(-1, meanSlope / 4))
  const twist = glide * 0.6 + direction * clamp01((jitter - 2) / 10) * 0.6
  return round2(Math.min(1, Math.max(-1, twist)))
}

/** 从约 2.5 秒的一句话里提取多维声纹特征，合成专属图案与人话版小报告 */
export function analyzeUtterance(
  samples: UtteranceSample[],
  mapPitch: (hz: number) => PatternParams,
): UtteranceResult {
  const pitches: number[] = []
  let loudSum = 0
  let loudCount = 0
  let centroidSum = 0
  let harmonicSum = 0
  let featureWeight = 0
  for (const s of samples) {
    if (s.pitchHz !== null) pitches.push(s.pitchHz)
    if (s.volume > 0.05) {
      loudSum += s.volume
      loudCount += 1
      centroidSum += (s.centroid ?? s.brightness * 0.5) * s.volume
      harmonicSum += (s.harmonicRatio ?? 0.3) * s.volume
      featureWeight += s.volume
    }
  }

  if (pitches.length < 5) {
    return { pattern: { ...mapPitch(220), a: 1, b: -0.8 }, energy: 0.15, report: r.silent }
  }

  // ① 低分位主基调 + 高分位重音峰双簇：主簇定基础线条，重音簇驱动物理真实的副模态
  const sorted = [...pitches].sort((x, y) => x - y)
  const dominant = sorted[Math.floor(sorted.length * 0.4)]
  const accent = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.85))]
  const base = mapPitch(dominant)
  let pitchMin = Infinity
  let pitchMax = -Infinity
  for (const p of pitches) {
    pitchMin = Math.min(pitchMin, p)
    pitchMax = Math.max(pitchMax, p)
  }
  const range = pitchMax - pitchMin

  // ② 频谱质心 → 耦合比 b 铺满 [-1.4, +1.4]，同音高的「啊 / 衣 / 呜」呈现不同开合
  const centroid = featureWeight > 0 ? centroidSum / featureWeight : 0.2
  const harmonic = featureWeight > 0 ? harmonicSum / featureWeight : 0.3
  const b = centroidToB(centroid)

  // ③ 语气起伏 + 节奏顿挫 + 真实泛音丰度 → 第二层叠纹
  const bursts = countRhythmBursts(samples)
  const strength = clamp01(range / 160) * 0.5 + clamp01(bursts / 6) * 0.2 + clamp01(harmonic) * 0.3
  let secondary: PatternParams['secondary']
  if (strength >= 0.25) {
    const accentMode = mapPitch(accent)
    let n2 = accentMode.n
    let m2 = accentMode.m
    if (n2 === base.n && m2 === base.m) {
      const delta = 1 + Math.round(strength * 2)
      n2 = base.m
      m2 = base.n + delta
      if (n2 === m2) m2 += 1
    }
    secondary = { n: n2, m: m2, weight: round2(clamp01(0.2 + 0.55 * strength + 0.25 * harmonic)) }
  }

  // ④ 语调滑音 → 反对称扭转，打破四象限死板镜像
  const twist = computeTwist(samples, pitches)

  // ⑤ 说话响度 → 聚拢后的星尘余振
  const loudness = loudCount > 0 ? loudSum / loudCount : 0
  const energy = 0.08 + 0.35 * clamp01(loudness * 1.8)

  const parts = [
    centroid < 0.15 ? r.brightLow : centroid < 0.35 ? r.brightMid : r.brightHigh,
    range < 40 ? r.rangeCalm : range < 100 ? r.rangeSome : r.rangeBig,
    r.rhythm(bursts),
    loudness < 0.12 ? r.volumeLow : loudness < 0.35 ? r.volumeMid : r.volumeHigh,
  ]
  if (secondary) parts.push(r.layered)

  const pattern: PatternParams = { ...base, a: 1, b, secondary }
  if (Math.abs(twist) >= 0.05) pattern.twist = twist
  return { pattern, energy, report: parts.join(' · ') }
}