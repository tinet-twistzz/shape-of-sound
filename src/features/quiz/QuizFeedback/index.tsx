import { Button } from '@/components/ui/Button'
import {
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  RefreshIcon,
  SpeakerIcon,
} from '@/components/ui/icons'
import { Tag } from '@/components/ui/Tag'
import { copy } from '@/content/copy'
import type { QuizResult } from '@/store/appStateContext'
import type { QuizQuestion } from '@/types/domain'

import styles from './QuizFeedback.module.css'

export interface QuizFeedbackProps {
  result: QuizResult | null
  question: QuizQuestion
  /** 答对时的一句话解释 */
  explanation: string
  isLast: boolean
  onNext: () => void
  onRetry: () => void
}

/** 判定反馈：答对 → 解释 + 下一幅；答错 → hint + 再试一次 */
export function QuizFeedback({
  result,
  question,
  explanation,
  isLast,
  onNext,
  onRetry,
}: QuizFeedbackProps) {
  return (
    <div className={styles.region} aria-live="polite">
      {result === null && (
        <div className={styles.idle}>
          <SpeakerIcon size={14} className={styles.idleIcon} />
          <p className="caption">{copy.sections.quiz.idleHint}</p>
        </div>
      )}

      {result === 'correct' && (
        <div className={`${styles.plate} ${styles.correct}`} key={`correct-${question.id}`}>
          <div className={styles.head}>
            <span className={`${styles.mark} ${styles.markCorrect}`} aria-hidden="true">
              <CheckIcon size={15} />
            </span>
            <h3 className={`display ${styles.title}`}>{copy.sections.quiz.correctTitle}</h3>
            <Tag tone="success">{copy.sections.quiz.collectedTag}</Tag>
          </div>
          <p className={styles.text}>{explanation}</p>
          <div className={styles.actions}>
            <Button onClick={onNext}>
              {isLast ? copy.sections.quiz.finishLabel : copy.sections.quiz.nextLabel}
              <ArrowRightIcon size={14} />
            </Button>
          </div>
        </div>
      )}

      {result === 'wrong' && (
        <div className={`${styles.plate} ${styles.wrong}`} key={`wrong-${question.id}`}>
          <div className={styles.head}>
            <span className={`${styles.mark} ${styles.markWrong}`} aria-hidden="true">
              <CloseIcon size={14} />
            </span>
            <h3 className={`display ${styles.title}`}>{copy.sections.quiz.wrongToast}</h3>
          </div>
          <p className={styles.text}>
            <span className={`mono ${styles.hintLabel}`}>{copy.sections.quiz.hintCode}</span>
            {question.hint}
          </p>
          <div className={styles.actions}>
            <Button variant="outline" onClick={onRetry}>
              <RefreshIcon size={14} />
              {copy.buttons.retry}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
