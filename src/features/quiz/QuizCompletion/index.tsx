import { PatternThumbnail } from '@/components/sand/PatternThumbnail'
import { Button } from '@/components/ui/Button'
import { ArrowRightIcon, RefreshIcon, SparkIcon } from '@/components/ui/icons'
import { Tag } from '@/components/ui/Tag'
import { copy } from '@/content/copy'
import type { SoundPreset } from '@/types/domain'

import styles from './QuizCompletion.module.css'

export interface QuizCompletionProps {
  collected: SoundPreset[]
  total: number
  onGoStudio: () => void
  onRestart: () => void
}

/** 全部答完的结语卡片 */
export function QuizCompletion({ collected, total, onGoStudio, onRestart }: QuizCompletionProps) {
  return (
    <div className={styles.card}>
      <span className={styles.spark} aria-hidden="true">
        <SparkIcon size={22} />
      </span>
      <span className={`mono ${styles.code}`}>{copy.sections.quiz.completionCode}</span>
      <h3 className={`display ${styles.title}`}>{copy.sections.quiz.completionTitle}</h3>
      <p className={`caption ${styles.note}`}>{copy.sections.quiz.completionNote}</p>
      <Tag tone="success">
        {copy.sections.quiz.collectionLabel} {collected.length} / {total} ·{' '}
        {copy.sections.quiz.completionAll}
      </Tag>

      {collected.length > 0 && (
        <ul className={styles.strip} aria-label={copy.sections.quiz.collectedLabel}>
          {collected.map((preset, index) => (
            <li
              key={preset.id}
              className={styles.cell}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <PatternThumbnail pattern={preset.pattern} size={72} theme="gold" />
              <span className={`mono ${styles.cellName}`}>{preset.patternName}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Button size="lg" onClick={onGoStudio}>
          {copy.sections.quiz.goStudioLabel}
          <ArrowRightIcon size={15} />
        </Button>
        <Button variant="outline" size="lg" onClick={onRestart}>
          <RefreshIcon size={15} />
          {copy.sections.quiz.restartLabel}
        </Button>
      </div>
    </div>
  )
}
