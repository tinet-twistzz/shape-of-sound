import { copy } from '@/content/copy'

import styles from './QuizProgress.module.css'

export interface QuizProgressProps {
  /** 当前题下标（0 起） */
  index: number
  total: number
  /** 当前题是否已答对（进度条随之填满一格） */
  solved: boolean
}

/** 「第 2 / 5 幅」+ 细进度条 */
export function QuizProgress({ index, total, solved }: QuizProgressProps) {
  const done = Math.min(total, index + (solved ? 1 : 0))
  const current = Math.min(index + 1, total)
  const percent = total > 0 ? (done / total) * 100 : 0

  return (
    <div className={styles.progress}>
      <span className={`mono ${styles.text}`}>
        {copy.sections.quiz.progressPrefix} <strong className={styles.current}>{current}</strong> /{' '}
        {total} {copy.sections.quiz.progressSuffix}
      </span>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={copy.sections.quiz.progressLabel}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
