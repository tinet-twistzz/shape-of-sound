import type { InputMode, ParticleTheme, PatternParams, ReplayMeta } from '@/types/domain'

/** 公共展厅与我的展厅统一的重放数据源 */
export interface ReplayWork {
  id: string
  title: string
  author: string
  theme: ParticleTheme
  source: InputMode
  frequencyHz: number
  pattern: PatternParams
  replayMeta: ReplayMeta
  createdAt: number
  imageUrl: string
  getState(): Promise<ArrayBuffer | null>
}