import { Button } from '@/components/ui/Button'
import { MicIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import type { MicStatus } from '@/types/domain'

import styles from './MicPanel.module.css'

export interface MicPanelProps {
  status: MicStatus
  onStart: () => void
  onStop: () => void
  onBackToSlider: () => void
  className?: string
}

const t = copy.sections.studio

const STATUS_TEXT: Record<MicStatus, string> = {
  idle: t.micIdle,
  requesting: t.micRequesting,
  listening: t.micListening,
  denied: t.micDenied,
  unsupported: t.micUnsupported,
}

/** 麦克风哼唱面板：开启 / 停止 / 状态提示 / 失败回退 */
export function MicPanel({ status, onStart, onStop, onBackToSlider, className }: MicPanelProps) {
  const failed = status === 'denied' || status === 'unsupported'
  const classes = [styles.panel, className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className={styles.statusRow} role="status" aria-live="polite">
        <span
          className={[
            styles.led,
            status === 'listening' && styles.ledLive,
            status === 'requesting' && styles.ledBusy,
            failed && styles.ledError,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        />
        <span className={`mono ${styles.statusText}`}>{STATUS_TEXT[status]}</span>
      </div>

      {status === 'idle' && (
        <Button variant="cyan" size="lg" className={styles.startButton} onClick={onStart}>
          <MicIcon size={18} />
          {t.micStart}
        </Button>
      )}

      {status === 'requesting' && (
        <Button variant="cyan" size="lg" className={styles.startButton} disabled>
          <MicIcon size={18} />
          {t.micRequesting}
        </Button>
      )}

      {status === 'listening' && (
        <Button variant="outline" size="lg" className={styles.startButton} onClick={onStop}>
          <span className={styles.stopSquare} aria-hidden="true" />
          {t.micStop}
        </Button>
      )}

      {failed && (
        <div className={styles.fallback}>
          <p className={styles.fallbackText}>
            {status === 'denied' ? t.micDeniedFallback : t.micUnsupportedFallback}
          </p>
          <Button variant="primary" size="md" onClick={onBackToSlider}>
            {t.backToSlider}
          </Button>
        </div>
      )}

      {!failed && <p className={styles.hint}>{t.micHint}</p>}
    </div>
  )
}
