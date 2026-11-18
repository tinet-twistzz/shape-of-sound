import type { PatternParams } from '@/types/domain'

export type TimelineSlice = NonNullable<PatternParams['timelineSlices']>[number]

export interface LongSoundSample {
  pitchHz: number | null
  volume: number
  brightness: number
}

export const LONG_MIN_SECONDS = 3
export const LONG_MAX_SECONDS = 20
export const TIMELINE_SLICE_COUNT = 16

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * 把一段长录音的逐帧声纹按时间均匀重采样成 16 个切片：
 * 每个切片记录那一刻的平均音高（→ 花纹疏密）、音色明暗（→ 花瓣开合）与响度权重。
 * 安静的时段借用邻近时刻的花纹但权重降低；整段几乎无声时返回 null。
 */
export function compressTimeline(
  samples: LongSoundSample[],
  mapPitch: (hz: number) => PatternParams,
): TimelineSlice[] | null {
  if (samples.length < TIMELINE_SLICE_COUNT) return null

  const bucketSize = samples.length / TIMELINE_SLICE_COUNT
  const raw: Array<TimelineSlice | null> = []
  let voicedTotal = 0

  for (let k = 0; k < TIMELINE_SLICE_COUNT; k += 1) {
    const start = Math.floor(k * bucketSize)
    const end = Math.max(start + 1, Math.floor((k + 1) * bucketSize))
    let pitchSum = 0
    let voiced = 0
    let volSum = 0
    let brightSum = 0
    let brightWeight = 0
    for (let i = start; i < end && i < samples.length; i += 1) {
      const s = samples[i]
      volSum += s.volume
      if (s.pitchHz !== null && s.volume > 0.04) {
        pitchSum += s.pitchHz
        voiced += 1
        brightSum += s.brightness * s.volume
        brightWeight += s.volume
      }
    }
    if (voiced >= 2) {
      voicedTotal += voiced
      const base = mapPitch(pitchSum / voiced)
      const brightness = brightWeight > 0 ? brightSum / brightWeight : 0.4
      raw.push({
        n: Math.max(1, Math.round(base.n)),
        m: Math.max(1, Math.round(base.m)),
        a: 1,
        b: round3(-(0.35 + clamp01(brightness) * 1.1)),
        weight: volSum / (end - start),
      })
    } else {
      raw.push(null)
    }
  }

  if (voicedTotal < 8) return null

  // 安静时段：借用时间上最近的有声切片，权重压低，保留整段时间轴的完整
  for (let k = 0; k < raw.length; k += 1) {
    if (raw[k] !== null) continue
    let donor: TimelineSlice | null = null
    for (let d = 1; d < raw.length && donor === null; d += 1) {
      donor = raw[k - d] ?? raw[k + d] ?? null
    }
    if (donor) raw[k] = { ...donor, weight: donor.weight * 0.25 }
  }

  const slices = raw.filter((s): s is TimelineSlice => s !== null)
  let maxWeight = 0
  for (const s of slices) maxWeight = Math.max(maxWeight, s.weight)
  if (maxWeight <= 0) return null
  for (const s of slices) s.weight = round3(Math.max(0.12, s.weight / maxWeight))
  return slices
}