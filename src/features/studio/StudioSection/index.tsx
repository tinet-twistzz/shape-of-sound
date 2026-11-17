import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { Section } from '@/components/layout/Section'
import { SandCanvas } from '@/components/sand/SandCanvas'
import type { SandCanvasHandle } from '@/components/sand/SandCanvas'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { QuestionIcon, SpeakerIcon } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast/toastContext'
import { copy } from '@/content/copy'
import { useServices } from '@/services/serviceContext'
import { useAppActions, useAppState } from '@/store/appStateContext'
import type { Artwork, InputMode } from '@/types/domain'

import { FrequencySlider } from '../FrequencySlider'
import { InputModeSwitch } from '../InputModeSwitch'
import { MicPanel } from '../MicPanel'
import { ParticleThemePicker } from '../ParticleThemePicker'
import { SignatureForm } from '../SignatureForm'
import { WaveIndicator } from '../WaveIndicator'
import { describeFrequency, energyForFrequency, previewWaveform } from '../frequencyMeta'

import styles from './StudioSection.module.css'

const t = copy.sections.studio

function ConsoleGroup({
  index,
  title,
  en,
  children,
}: {
  index: string
  title: string
  en: string
  children: ReactNode
}) {
  return (
    <section className={styles.group}>
      <header className={styles.groupHead}>
        <span className={`mono ${styles.groupIndex}`}>{index}</span>
        <h3 className={styles.groupTitle}>{title}</h3>
        <span className={`mono ${styles.groupEn}`}>{en}</span>
      </header>
      {children}
    </section>
  )
}

/** HALL 03 · 声绘工坊：左实时沙盘，右精密仪器控制台 */
export function StudioSection() {
  const { patternMapper, audioEngine, micInput, artworkExporter } = useServices()
  const { studio } = useAppState()
  const actions = useAppActions()
  const toast = useToast()
  const sandRef = useRef<SandCanvasHandle>(null)

  const [micEnergy, setMicEnergy] = useState<number | null>(null)
  const [micWaveform, setMicWaveform] = useState<Float32Array | null>(null)

  const { inputMode, frequencyHz, theme, author, micStatus } = studio
  const listening = inputMode === 'mic' && micStatus === 'listening'

  const pattern = useMemo(
    () => patternMapper.frequencyToPattern(frequencyHz),
    [patternMapper, frequencyHz],
  )
  const description = describeFrequency(frequencyHz)
  const energy = listening && micEnergy !== null ? micEnergy : energyForFrequency(frequencyHz)
  const sliderWave = useMemo(() => previewWaveform(frequencyHz), [frequencyHz])
  const waveform = inputMode === 'mic' ? micWaveform : sliderWave

  // 订阅麦克风数据：pitchHz → 图案，volume → 能量，waveform → 示波器
  useEffect(() => {
    if (!listening) return
    return micInput.subscribe((frame) => {
      if (frame.pitchHz !== null) actions.setFrequency(Math.round(frame.pitchHz))
      setMicEnergy(frame.volume)
      setMicWaveform(frame.waveform)
    })
  }, [listening, micInput, actions])

  const stopMic = useCallback(() => {
    micInput.stop()
    actions.setMicStatus('idle')
    setMicEnergy(null)
    setMicWaveform(null)
  }, [micInput, actions])

  // 切回滑动调音时收起麦克风
  useEffect(() => {
    if (inputMode === 'slider' && (micStatus === 'listening' || micStatus === 'requesting')) {
      stopMic()
    }
  }, [inputMode, micStatus, stopMic])

  // 离开页面 / 卸载时释放麦克风
  useEffect(() => () => micInput.stop(), [micInput])

  const startMic = useCallback(async () => {
    actions.setMicStatus('requesting')
    try {
      await micInput.start()
      actions.setMicStatus('listening')
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError'
      actions.setMicStatus(denied ? 'denied' : 'unsupported')
    }
  }, [micInput, actions])

  const handleModeChange = (mode: InputMode) => {
    actions.setInputMode(mode)
  }

  const handleCommit = (hz: number) => {
    audioEngine.playTone(hz)
    sandRef.current?.scatter()
  }

  const handleCollect = async () => {
    const artwork: Artwork = {
      id: `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      pattern,
      theme,
      author: author.trim() || t.anonymousAuthor,
      source: inputMode,
      frequencyHz,
      createdAt: Date.now(),
    }
    const snapshot = (await sandRef.current?.snapshot()) ?? null
    await artworkExporter.export(artwork, snapshot)
    toast(t.collectedToast, 'success')
  }

  return (
    <Section id="studio">
      <SectionHeader
        index={t.hallIndex}
        title={t.title}
        caption={t.caption}
        action={
          <Button variant="ghost" size="sm" onClick={() => actions.openPrinciple('try-at-home')}>
            <QuestionIcon size={14} />
            {copy.principle.openLabel}
          </Button>
        }
      />

      <div className={styles.layout}>
        <div className={styles.stage}>
          <div className={styles.stageSticky}>
            <SandCanvas
              ref={sandRef}
              pattern={pattern}
              theme={theme}
              energy={energy}
              interactive
              className={styles.canvas}
            />
            <div className={`mono ${styles.status}`} aria-live="polite">
              {listening ? (
                <>
                  <span className={styles.eq} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className={styles.statusText}>{t.statusListening(description)}</span>
                </>
              ) : (
                <>
                  <SpeakerIcon size={13} className={styles.statusIcon} />
                  <span className={styles.statusText}>
                    {inputMode === 'slider' ? t.statusSlider(description) : t.statusMicIdle}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.console}>
          <span className={`${styles.screw} ${styles.screwTl}`} aria-hidden="true" />
          <span className={`${styles.screw} ${styles.screwTr}`} aria-hidden="true" />
          <span className={`${styles.screw} ${styles.screwBl}`} aria-hidden="true" />
          <span className={`${styles.screw} ${styles.screwBr}`} aria-hidden="true" />

          <header className={styles.consoleHead}>
            <span className={`mono ${styles.consoleCode}`}>{t.consoleCode}</span>
            <span className={`mono ${styles.consoleLed} ${listening ? styles.consoleLedOn : ''}`}>
              {listening ? t.consoleLive : t.consoleStandby}
            </span>
          </header>

          <ConsoleGroup index="01" title={t.groupInput} en={t.groupInputEn}>
            <InputModeSwitch value={inputMode} onChange={handleModeChange} />
          </ConsoleGroup>

          <ConsoleGroup index="02" title={t.groupSignal} en={t.groupSignalEn}>
            {inputMode === 'slider' ? (
              <FrequencySlider
                value={frequencyHz}
                onChange={actions.setFrequency}
                onCommit={handleCommit}
              />
            ) : (
              <MicPanel
                status={micStatus}
                onStart={startMic}
                onStop={stopMic}
                onBackToSlider={() => handleModeChange('slider')}
              />
            )}
            <div className={styles.monitor}>
              <div className={styles.monitorHead}>
                <span className={`mono ${styles.monitorLabel}`}>{t.monitorLabel}</span>
                <span
                  className={`mono ${styles.monitorState} ${listening ? styles.monitorLive : ''}`}
                >
                  {listening
                    ? t.monitorLive
                    : inputMode === 'slider'
                      ? t.monitorPreview
                      : t.monitorIdle}
                </span>
              </div>
              <WaveIndicator waveform={waveform} live={listening} />
            </div>
          </ConsoleGroup>

          <ConsoleGroup index="03" title={t.themeLabel} en={t.groupMaterialEn}>
            <ParticleThemePicker value={theme} onChange={actions.setTheme} />
          </ConsoleGroup>

          <ConsoleGroup index="04" title={t.groupSignature} en={t.groupSignatureEn}>
            <SignatureForm
              author={author}
              onAuthorChange={actions.setAuthor}
              onSubmit={handleCollect}
            />
          </ConsoleGroup>
        </div>
      </div>
    </Section>
  )
}
