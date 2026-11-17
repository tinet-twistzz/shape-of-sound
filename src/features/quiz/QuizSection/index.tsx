import { useEffect, useMemo, useRef, useState } from 'react'

import { Section } from '@/components/layout/Section'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { QuestionIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useScrollTo } from '@/hooks/useScrollTo'
import { useServices } from '@/services/serviceContext'
import { useAppActions, useAppState } from '@/store/appStateContext'
import type { SoundPreset } from '@/types/domain'

import { CollectionBadge } from '../CollectionBadge'
import { QuizCompletion } from '../QuizCompletion'
import { QuizFeedback } from '../QuizFeedback'
import { QuizOptionList } from '../QuizOptionList'
import { QuizProgress } from '../QuizProgress'
import { TargetPatternCard } from '../TargetPatternCard'

import styles from './QuizSection.module.css'

/** mock 演奏时长：试听按钮上的均衡器动画持续时间 */
const PLAYING_MS = 1400

function QuizSkeleton() {
  return (
    <div className={styles.layout} aria-hidden="true">
      <div>
        <div className={`${styles.skeleton} ${styles.skeletonFrame}`} />
      </div>
      <div className={styles.panel}>
        <div className={`${styles.skeleton} ${styles.skeletonBar}`} />
        <div className={`${styles.skeleton} ${styles.skeletonOption}`} />
        <div className={`${styles.skeleton} ${styles.skeletonOption}`} />
        <div className={`${styles.skeleton} ${styles.skeletonOption}`} />
        <p className={`caption ${styles.loadingHint}`}>{copy.hints.loading}</p>
      </div>
    </div>
  )
}

/** HALL 02 · 寻声猜形：左画框目标图案，右候选声源 + 判定 + 图鉴 */
export function QuizSection() {
  const { dataSource, audioEngine } = useServices()
  const { quiz, muted } = useAppState()
  const actions = useAppActions()
  const scrollTo = useScrollTo()
  const [retryKey, setRetryKey] = useState(0)
  const questions = useAsyncData(() => dataSource.getQuizQuestions(), [dataSource, retryKey])
  const presets = useAsyncData(() => dataSource.getSoundPresets(), [dataSource, retryKey])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const playTimer = useRef<number | null>(null)

  const list = questions.data
  const presetList = presets.data
  const loading = questions.loading || presets.loading
  const error = questions.error ?? presets.error

  const presetById = useMemo(
    () => new Map((presetList ?? []).map((preset) => [preset.id, preset])),
    [presetList],
  )

  const total = list?.length ?? 0
  const question = list && quiz.index < list.length ? list[quiz.index] : null
  const completed = list !== null && total > 0 && quiz.index >= total

  const options = useMemo(() => {
    if (!question) return []
    return question.optionSoundIds
      .map((id) => presetById.get(id))
      .filter((preset): preset is SoundPreset => preset !== undefined)
  }, [question, presetById])

  const answerPreset = question ? (presetById.get(question.answerSoundId) ?? null) : null
  const collected = useMemo(
    () =>
      quiz.collectedIds
        .map((id) => presetById.get(id))
        .filter((preset): preset is SoundPreset => preset !== undefined),
    [quiz.collectedIds, presetById],
  )

  useEffect(
    () => () => {
      if (playTimer.current !== null) window.clearTimeout(playTimer.current)
    },
    [],
  )

  const startPlaying = (preset: SoundPreset) => {
    audioEngine.play(preset)
    setPlayingId(preset.id)
    if (playTimer.current !== null) window.clearTimeout(playTimer.current)
    playTimer.current = window.setTimeout(() => setPlayingId(null), PLAYING_MS)
  }

  const handleChoose = (soundId: string) => {
    if (!question) return
    const preset = presetById.get(soundId)
    if (preset) startPlaying(preset)
    actions.answerQuiz(question, soundId)
  }

  const explanation = question
    ? (copy.sections.quiz.explanations[question.id] ??
      (answerPreset
        ? copy.sections.quiz.explanationFor(answerPreset.name)
        : copy.sections.quiz.explanationGeneric))
    : ''

  const caption = question
    ? copy.sections.quiz.questionCaption(question.targetPatternName)
    : copy.sections.quiz.caption

  return (
    <Section id="quiz">
      <SectionHeader
        index={copy.sections.quiz.hallIndex}
        title={copy.sections.quiz.title}
        caption={caption}
        action={
          <Button variant="ghost" size="sm" onClick={() => actions.openPrinciple('higher-denser')}>
            <QuestionIcon size={14} />
            {copy.principle.openLabel}
          </Button>
        }
      />

      {loading && <QuizSkeleton />}

      {error && (
        <div className={styles.errorPlate} role="alert">
          <span className={`mono ${styles.errorCode}`}>{copy.hints.errorCode}</span>
          <p className="caption">{copy.hints.loadError}</p>
          <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
            {copy.buttons.retry}
          </Button>
        </div>
      )}

      {list && total === 0 && (
        <div className={styles.errorPlate}>
          <p className="caption">{copy.hints.empty}</p>
        </div>
      )}

      {completed && presetList && (
        <QuizCompletion
          collected={collected}
          total={total}
          onGoStudio={() => scrollTo('studio')}
          onRestart={actions.resetQuiz}
        />
      )}

      {question && (
        <div className={styles.layout}>
          <div className={styles.stage}>
            <div className={styles.stageSticky}>
              <TargetPatternCard
                key={question.id}
                pattern={question.targetPattern}
                patternName={question.targetPatternName}
                code={copy.sections.quiz.plateCode(quiz.index + 1)}
                revealedSound={quiz.result === 'correct' ? answerPreset : null}
              />
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.toolbar}>
              <QuizProgress index={quiz.index} total={total} solved={quiz.result === 'correct'} />
              <CollectionBadge collected={collected} total={total} />
            </div>

            <QuizOptionList
              options={options}
              answerSoundId={question.answerSoundId}
              selectedSoundId={quiz.selectedSoundId}
              result={quiz.result}
              playingId={playingId}
              muted={muted}
              onPreview={startPlaying}
              onChoose={handleChoose}
            />

            <QuizFeedback
              result={quiz.result}
              question={question}
              explanation={explanation}
              isLast={quiz.index === total - 1}
              onNext={actions.nextQuestion}
              onRetry={actions.retryQuiz}
            />
          </div>
        </div>
      )}
    </Section>
  )
}
