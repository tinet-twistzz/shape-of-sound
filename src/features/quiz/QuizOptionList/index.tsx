import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CheckIcon, SpeakerIcon, SpeakerMutedIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import type { QuizResult } from '@/store/appStateContext'
import type { SoundPreset } from '@/types/domain'

import styles from './QuizOptionList.module.css'

export interface QuizOptionListProps {
  options: SoundPreset[]
  answerSoundId: string
  selectedSoundId: string | null
  result: QuizResult | null
  playingId: string | null
  muted: boolean
  onPreview: (preset: SoundPreset) => void
  onChoose: (soundId: string) => void
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D']

/** 三个候选声源：试听 + 「就是它」 */
export function QuizOptionList({
  options,
  answerSoundId,
  selectedSoundId,
  result,
  playingId,
  muted,
  onPreview,
  onChoose,
}: QuizOptionListProps) {
  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {options.map((preset, index) => {
          const isChosen = selectedSoundId === preset.id
          const isCorrect = result === 'correct' && preset.id === answerSoundId
          const isWrong = result === 'wrong' && isChosen
          const playing = playingId === preset.id
          const classes = [styles.option, isCorrect && styles.correct, isWrong && styles.wrong]
            .filter(Boolean)
            .join(' ')

          return (
            <li key={preset.id}>
              <Card className={classes}>
                <div className={styles.row}>
                  <span className={`mono ${styles.letter}`} aria-hidden="true">
                    {OPTION_LETTERS[index]}
                  </span>
                  <span className={styles.emoji} aria-hidden="true">
                    {preset.emoji}
                  </span>
                  <span className={styles.body}>
                    <span className={styles.name}>{preset.name}</span>
                    <span className={`mono ${styles.readout}`} aria-live="off">
                      {playing
                        ? copy.sections.quiz.playingReadout
                        : copy.sections.quiz.optionReadout}
                    </span>
                  </span>
                  {isCorrect && (
                    <span
                      className={styles.correctMark}
                      aria-label={copy.sections.quiz.correctMark}
                    >
                      <CheckIcon size={14} />
                    </span>
                  )}
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPreview(preset)}
                    aria-label={copy.sections.quiz.previewAria(preset.name)}
                    className={styles.preview}
                  >
                    {playing ? (
                      <span className={styles.eq} aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      <SpeakerIcon size={13} />
                    )}
                    {copy.sections.quiz.previewLabel}
                  </Button>
                  <Button
                    variant={isCorrect ? 'primary' : 'cyan'}
                    size="sm"
                    disabled={result !== null}
                    onClick={() => onChoose(preset.id)}
                  >
                    {copy.sections.quiz.submitLabel}
                  </Button>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      {muted && (
        <p className={`caption ${styles.mutedHint}`}>
          <SpeakerMutedIcon size={13} aria-hidden="true" />
          {copy.hints.muted}
        </p>
      )}
    </div>
  )
}
