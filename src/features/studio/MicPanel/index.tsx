import { Button } from '@/components/ui/Button'
import { MicIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import type { CompressionMode, MicStatus, PlateShape } from '@/types/domain'

import { LONG_MAX_SECONDS, LONG_MIN_SECONDS } from '../longSoundCompression'

import styles from './MicPanel.module.css'

export type CapturePhase = 'idle' | 'recording' | 'done'

export type LongPhase = 'idle' | 'recording' | 'frozen'

export const CAPTURE_SECONDS = 2.5

export interface MicPanelProps {
  status: MicStatus
  capturePhase: CapturePhase
  secondsLeft: number
  report: string | null
  plateShape: PlateShape
  longPhase: LongPhase
  longElapsed: number
  longDuration: number | null
  compressionMode: CompressionMode
  onStart: () => void
  onStop: () => void
  onCapture: () => void
  onPlateShapeChange: (shape: PlateShape) => void
  onStartLong: () => void
  onFinishLong: () => void
  onCompressionModeChange: (mode: CompressionMode) => void
  onResetLong: () => void
  onBackToSlider: () => void
  className?: string
}

const t = copy.sections.studio
const lc = t.longCapture

const STATUS_TEXT: Record<MicStatus, string> = {
  idle: t.micIdle,
  requesting: t.micRequesting,
  listening: t.micListening,
  denied: t.micDenied,
  unsupported: t.micUnsupported,
}

/** 麦克风面板：说一句话画画 / 长声音压缩录画 / 实时随动 / 失败回退 */
export function MicPanel({
  status,
  capturePhase,
  secondsLeft,
  report,
  plateShape,
  longPhase,
  longElapsed,
  longDuration,
  compressionMode,
  onStart,
  onStop,
  onCapture,
  onPlateShapeChange,
  onStartLong,
  onFinishLong,
  onCompressionModeChange,
  onResetLong,
  onBackToSlider,
  className,
}: MicPanelProps) {
  const failed = status === 'denied' || status === 'unsupported'
  const recording = capturePhase === 'recording'
  const longRecording = longPhase === 'recording'
  const longFrozen = longPhase === 'frozen'
  const done = capturePhase === 'done' && report !== null && longPhase === 'idle'
  const busy = recording || longRecording
  const classes = [styles.panel, className].filter(Boolean).join(' ')

  const statusText = longRecording
    ? lc.recording
    : longFrozen
      ? lc.frozenTitle((longDuration ?? 0).toFixed(1))
      : recording
        ? t.captureListening
        : done
          ? t.captureDone
          : STATUS_TEXT[status]
  const progress = Math.min(1, Math.max(0, 1 - secondsLeft / CAPTURE_SECONDS))
  const longProgress = Math.min(100, (longElapsed / LONG_MAX_SECONDS) * 100)
  const canFinishLong = longElapsed >= LONG_MIN_SECONDS

  return (
    <div className={classes}>
      <div className={styles.statusRow} role="status" aria-live="polite">
        <span
          className={[
            styles.led,
            (status === 'listening' || busy) && styles.ledLive,
            (done || longFrozen) && styles.ledDone,
            status === 'requesting' && styles.ledBusy,
            failed && styles.ledError,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        />
        <span className={`mono ${styles.statusText}`}>{statusText}</span>
      </div>

      {recording && (
        <div className={styles.countdown}>
          <span className={`mono ${styles.countdownNumber}`}>{secondsLeft.toFixed(1)}</span>
          <div className={styles.meter} aria-hidden="true">
            <span className={styles.meterFill} style={{ width: `${progress * 100}%` }} />
          </div>
          <span className={styles.countdownLabel}>{t.captureCountdown(secondsLeft.toFixed(1))}</span>
        </div>
      )}

      {longRecording && (
        <div className={styles.countdown}>
          <span className={`mono ${styles.countdownNumber}`}>{longElapsed.toFixed(1)}s</span>
          <div
            className={styles.meter}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={LONG_MAX_SECONDS}
            aria-valuenow={Math.round(longElapsed)}
            aria-label={lc.elapsed(longElapsed.toFixed(1))}
          >
            <span className={styles.meterFill} style={{ width: `${longProgress}%` }} />
          </div>
          <span className={styles.countdownLabel}>{lc.recording}</span>
          <span className={`mono ${styles.countdownLabel}`}>
            {lc.elapsed(longElapsed.toFixed(1))}
          </span>
          <Button
            variant="primary"
            size="lg"
            className={styles.startButton}
            onClick={onFinishLong}
            disabled={!canFinishLong}
          >
            {canFinishLong ? lc.finish : lc.finishTooShort}
          </Button>
        </div>
      )}

      {done && !busy && (
        <div className={styles.reportCard} role="status" aria-live="polite">
          <span className={`mono ${styles.reportTitle}`}>{t.reportTitle}</span>
          <p className={styles.reportText}>{report}</p>
          <div className={styles.reportActions}>
            <Button variant="cyan" size="md" onClick={onCapture}>
              <MicIcon size={16} />
              {t.captureAgain}
            </Button>
            <div className={styles.plateSwitch} role="group" aria-label={t.plateSwitchAria}>
              <Button
                variant={plateShape === 'square' ? 'primary' : 'outline'}
                size="sm"
                aria-pressed={plateShape === 'square'}
                onClick={() => onPlateShapeChange('square')}
              >
                {t.plateSquare}
              </Button>
              <Button
                variant={plateShape === 'circle' ? 'primary' : 'outline'}
                size="sm"
                aria-pressed={plateShape === 'circle'}
                onClick={() => onPlateShapeChange('circle')}
              >
                {t.plateCircle}
              </Button>
            </div>
          </div>
        </div>
      )}

      {longFrozen && !busy && (
        <div className={styles.reportCard} role="status" aria-live="polite">
          <span className={`mono ${styles.reportTitle}`}>
            {lc.frozenTitle((longDuration ?? 0).toFixed(1))}
          </span>
          <div className={styles.plateSwitch} role="group" aria-label={lc.modeAria}>
            <Button
              variant={compressionMode === 'rings' ? 'primary' : 'outline'}
              size="sm"
              aria-pressed={compressionMode === 'rings'}
              onClick={() => onCompressionModeChange('rings')}
            >
              {lc.modeRings}
            </Button>
            <Button
              variant={compressionMode === 'exposure' ? 'primary' : 'outline'}
              size="sm"
              aria-pressed={compressionMode === 'exposure'}
              onClick={() => onCompressionModeChange('exposure')}
            >
              {lc.modeExposure}
            </Button>
          </div>
          <p className={styles.modeDesc}>
            {compressionMode === 'rings' ? lc.ringsDesc : lc.exposureDesc}
          </p>
          <div className={styles.reportActions}>
            <Button variant="cyan" size="md" onClick={onStartLong}>
              <MicIcon size={16} />
              {lc.again}
            </Button>
            <Button variant="ghost" size="sm" onClick={onResetLong}>
              {lc.backLive}
            </Button>
          </div>
        </div>
      )}

      {!failed && !busy && !done && !longFrozen && (
        <>
          {status === 'idle' && (
            <>
              <Button variant="cyan" size="lg" className={styles.startButton} onClick={onCapture}>
                {t.captureStart}
              </Button>
              <Button
                variant="violet"
                size="lg"
                className={styles.startButton}
                onClick={onStartLong}
              >
                {lc.start}
              </Button>
              <Button variant="outline" size="md" className={styles.startButton} onClick={onStart}>
                <MicIcon size={16} />
                {t.micStart}
              </Button>
              <p className={styles.subHint}>{lc.hint}</p>
            </>
          )}

          {status === 'requesting' && (
            <Button variant="cyan" size="lg" className={styles.startButton} disabled>
              <MicIcon size={18} />
              {t.micRequesting}
            </Button>
          )}

          {status === 'listening' && (
            <>
              <Button variant="outline" size="lg" className={styles.startButton} onClick={onStop}>
                <span className={styles.stopSquare} aria-hidden="true" />
                {t.micStop}
              </Button>
              <Button variant="cyan" size="md" className={styles.startButton} onClick={onCapture}>
                {t.captureStart}
              </Button>
              <Button
                variant="violet"
                size="md"
                className={styles.startButton}
                onClick={onStartLong}
              >
                {lc.start}
              </Button>
            </>
          )}
        </>
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

      {!failed && !busy && !done && !longFrozen && (
        <p className={styles.hint}>{status === 'listening' ? t.micHint : t.captureHint}</p>
      )}
    </div>
  )
}