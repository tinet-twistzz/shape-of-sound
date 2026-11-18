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
import { centroidToB } from '@/services/real/chladniPatternMapper'
import { GalleryError } from '@/services/real/galleryService'
import { localGallery } from '@/services/real/localGallery'
import { useAppActions, useAppState } from '@/store/appStateContext'
import type { Artwork, CompressionMode, InputMode, ParticleMedium, PatternParams, PlateShape, ReplayMeta, ResonanceChord } from '@/types/domain'

import { ChordSelector } from '../ChordSelector'
import { FrequencySlider } from '../FrequencySlider'
import { InputModeSwitch } from '../InputModeSwitch'
import { MediumPicker } from '../MediumPicker'
import { CAPTURE_SECONDS, MicPanel } from '../MicPanel'
import type { CapturePhase, LongPhase } from '../MicPanel'
import { ParticleThemePicker } from '../ParticleThemePicker'
import { PlateShapePicker } from '../PlateShapePicker'
import { PublishDialog } from '../PublishDialog'
import { SignatureForm } from '../SignatureForm'
import type { SignatureBusy } from '../SignatureForm'
import { TimbreSlider } from '../TimbreSlider'
import { WaveIndicator } from '../WaveIndicator'
import { chordBOffset, chordSecondary, chordTwist } from '../chordMeta'
import { describeFrequency, energyForFrequency, previewWaveform } from '../frequencyMeta'
import { LONG_MAX_SECONDS, LONG_MIN_SECONDS, compressTimeline } from '../longSoundCompression'
import type { LongSoundSample, TimelineSlice } from '../longSoundCompression'
import { DEFAULT_TIMBRE, timbreToB } from '../timbreMeta'
import { analyzeUtterance } from '../utteranceAnalysis'
import type { UtteranceResult, UtteranceSample } from '../utteranceAnalysis'

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
  const { patternMapper, audioEngine, micInput, artworkExporter, galleryService } = useServices()
  const { studio } = useAppState()
  const actions = useAppActions()
  const toast = useToast()
  const sandRef = useRef<SandCanvasHandle>(null)

  const [micEnergy, setMicEnergy] = useState<number | null>(null)
  const [micWaveform, setMicWaveform] = useState<Float32Array | null>(null)
  const [micCentroid, setMicCentroid] = useState<number | null>(null)
  const [capturePhase, setCapturePhase] = useState<CapturePhase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(CAPTURE_SECONDS)
  const [utterance, setUtterance] = useState<UtteranceResult | null>(null)
  const [plateShape, setPlateShape] = useState<PlateShape>('square')
  const [medium, setMedium] = useState<ParticleMedium>('sand')
  const captureCancelRef = useRef<(() => void) | null>(null)
  const [longPhase, setLongPhase] = useState<LongPhase>('idle')
  const [longElapsed, setLongElapsed] = useState(0)
  const [longDuration, setLongDuration] = useState<number | null>(null)
  const [longSlices, setLongSlices] = useState<TimelineSlice[] | null>(null)
  const [compressionMode, setCompressionMode] = useState<CompressionMode>('rings')
  const [frozenEnergy, setFrozenEnergy] = useState(0.08)
  const longCancelRef = useRef<(() => void) | null>(null)
  const finishLongRef = useRef<(() => void) | null>(null)
  const [voiceDensity, setVoiceDensity] = useState(0.3)
  const [colorBand, setColorBand] = useState<0 | 1 | 2 | 3>(1)
  const [timbre, setTimbre] = useState(DEFAULT_TIMBRE)
  const [chord, setChord] = useState<ResonanceChord>('solo')
  const [busy, setBusy] = useState<SignatureBusy>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const voiceChargeRef = useRef(0)
  const voiceLastAtRef = useRef(0)

  const { inputMode, frequencyHz, theme, author, micStatus } = studio
  const listening = inputMode === 'mic' && micStatus === 'listening'
  const inputModeRef = useRef(inputMode)
  useEffect(() => {
    inputModeRef.current = inputMode
  }, [inputMode])

  // 人声路径统一走动态频段映射（85–650Hz 舒展到全阶模态），mock 映射器无此方法时退回扫频映射
  const mapVoicePitch = useCallback(
    (hz: number): PatternParams =>
      patternMapper.voiceFrequencyToPattern
        ? patternMapper.voiceFrequencyToPattern(hz)
        : patternMapper.frequencyToPattern(hz),
    [patternMapper],
  )

  const pattern = useMemo((): PatternParams => {
    if (inputMode === 'mic' && longSlices) {
      return {
        n: longSlices[0].n,
        m: longSlices[0].m,
        a: 1,
        b: -1,
        plateShape: compressionMode === 'rings' ? 'circle' : plateShape,
        medium,
        compressionMode,
        timelineSlices: longSlices,
      }
    }
    if (inputMode === 'mic' && utterance) return { ...utterance.pattern, plateShape, medium }
    if (inputMode === 'mic') {
      // 实时哼唱：音高定模态，当前帧频谱质心微调耦合比，不同元音呈现不同花瓣开合
      const base = mapVoicePitch(frequencyHz)
      const b = micCentroid !== null ? centroidToB(micCentroid) : base.b
      return { ...base, b, plateShape, medium }
    }
    // 滑杆模式：频率定主模态，音色形态定耦合比，和弦档位叠副模态 / 扭转场
    const base = patternMapper.frequencyToPattern(frequencyHz)
    const next: PatternParams = {
      ...base,
      a: 1,
      b: Math.round((timbreToB(timbre) + chordBOffset(chord)) * 100) / 100,
      plateShape,
      medium,
    }
    const secondary = chordSecondary(base.n, base.m, chord)
    if (secondary) next.secondary = secondary
    else delete next.secondary
    const twist = chordTwist(chord)
    if (twist !== 0) next.twist = twist
    return next
  }, [inputMode, longSlices, compressionMode, utterance, plateShape, medium, patternMapper, frequencyHz, mapVoicePitch, micCentroid, timbre, chord])
  const description = describeFrequency(frequencyHz)
  const energy =
    inputMode === 'mic' && longSlices
      ? frozenEnergy
      : inputMode === 'mic' && utterance
        ? utterance.energy
        : listening && micEnergy !== null
          ? micEnergy
          : energyForFrequency(frequencyHz)
  const sliderWave = useMemo(() => previewWaveform(frequencyHz), [frequencyHz])
  const waveform = inputMode === 'mic' ? micWaveform : sliderWave

  // 订阅麦克风数据：pitchHz → 图案，volume → 能量，waveform → 示波器；
  // 有效发声累计能量 → 彩沙密度，音高 × 明亮度 → 当前色桶（响亮峰值直达星白）
  useEffect(() => {
    if (!listening) return
    voiceLastAtRef.current = performance.now()
    return micInput.subscribe((frame) => {
      if (frame.pitchHz !== null) actions.setFrequency(Math.round(frame.pitchHz))
      setMicEnergy(frame.volume)
      setMicWaveform(frame.waveform)
      setMicCentroid(frame.centroid ?? null)
      const now = performance.now()
      const dt = Math.min(0.1, (now - voiceLastAtRef.current) / 1000)
      voiceLastAtRef.current = now
      if (frame.volume <= 0.045) return
      if (frame.volume > 0.7) {
        setColorBand(3)
      } else {
        const brightness = frame.brightness ?? 0.4
        const score = Math.log2(Math.max(60, frame.pitchHz ?? 200) / 120) * 0.5 + brightness * 1.2
        setColorBand(score < 0.75 ? 0 : score < 1.35 ? 1 : 2)
      }
      voiceChargeRef.current = Math.min(
        1,
        voiceChargeRef.current + dt * (0.08 + frame.volume * 0.25),
      )
      setVoiceDensity(0.3 + 0.7 * voiceChargeRef.current)
    })
  }, [listening, micInput, actions])

  const stopMic = useCallback(() => {
    micInput.stop()
    actions.setMicStatus('idle')
    setMicEnergy(null)
    setMicWaveform(null)
    setMicCentroid(null)
  }, [micInput, actions])

  const resetVoiceSand = useCallback(() => {
    voiceChargeRef.current = 0
    voiceLastAtRef.current = 0
    setVoiceDensity(0.3)
  }, [])

  const resetLong = useCallback(() => {
    if (longCancelRef.current) {
      longCancelRef.current()
      longCancelRef.current = null
    }
    finishLongRef.current = null
    setLongPhase('idle')
    setLongSlices(null)
    setLongDuration(null)
    setLongElapsed(0)
  }, [])

  // 切回滑动调音时收起麦克风，并取消进行中的采集与长声录画
  useEffect(() => {
    if (inputMode !== 'slider') return
    if (captureCancelRef.current) {
      captureCancelRef.current()
      captureCancelRef.current = null
    }
    resetLong()
    setCapturePhase('idle')
    setUtterance(null)
    resetVoiceSand()
    if (micStatus === 'listening' || micStatus === 'requesting') {
      stopMic()
    }
  }, [inputMode, micStatus, stopMic, resetLong, resetVoiceSand])

  // 离开页面 / 卸载时释放麦克风与采集定时器
  useEffect(
    () => () => {
      if (captureCancelRef.current) {
        captureCancelRef.current()
        captureCancelRef.current = null
      }
      if (longCancelRef.current) {
        longCancelRef.current()
        longCancelRef.current = null
      }
      micInput.stop()
    },
    [micInput],
  )

  const startMic = useCallback(async () => {
    audioEngine.stop()
    actions.setMicStatus('requesting')
    try {
      await micInput.start()
      actions.setMicStatus('listening')
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError'
      actions.setMicStatus(denied ? 'denied' : 'unsupported')
    }
  }, [audioEngine, micInput, actions])

  const handleRealtimeStart = useCallback(() => {
    setUtterance(null)
    setCapturePhase('idle')
    resetLong()
    resetVoiceSand()
    void startMic()
  }, [startMic, resetLong, resetVoiceSand])

  // 说一句话画画：采集 2.5 秒帧数据 → 提取特征 → 定格专属图案
  const startCapture = useCallback(async () => {
    if (captureCancelRef.current) return
    resetLong()
    resetVoiceSand()
    setUtterance(null)
    audioEngine.stop()
    if (micStatus !== 'listening') {
      actions.setMicStatus('requesting')
      try {
        await micInput.start()
      } catch (error) {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        actions.setMicStatus(denied ? 'denied' : 'unsupported')
        return
      }
      if (inputModeRef.current !== 'mic') return
      actions.setMicStatus('listening')
    }
    const samples: UtteranceSample[] = []
    const unsubscribe = micInput.subscribe((frame) => {
      samples.push({
        pitchHz: frame.pitchHz,
        volume: frame.volume,
        brightness: frame.brightness ?? 0.4,
        centroid: frame.centroid,
        harmonicRatio: frame.harmonicRatio,
      })
    })
    setCapturePhase('recording')
    setSecondsLeft(CAPTURE_SECONDS)
    const startedAt = performance.now()
    const ticker = window.setInterval(() => {
      setSecondsLeft(Math.max(0, CAPTURE_SECONDS - (performance.now() - startedAt) / 1000))
    }, 100)
    const timer = window.setTimeout(() => {
      if (captureCancelRef.current) {
        captureCancelRef.current()
        captureCancelRef.current = null
      }
      micInput.stop()
      actions.setMicStatus('idle')
      setMicWaveform(null)
      const result = analyzeUtterance(samples, mapVoicePitch)
      setUtterance(result)
      setSecondsLeft(0)
      setCapturePhase('done')
      sandRef.current?.scatter()
    }, CAPTURE_SECONDS * 1000)
    captureCancelRef.current = () => {
      window.clearTimeout(timer)
      window.clearInterval(ticker)
      unsubscribe()
    }
  }, [micStatus, micInput, audioEngine, actions, mapVoicePitch, resetLong, resetVoiceSand])

  // 长声音压缩录画：3~20 秒逐帧采集 → 重采样成 16 个时间切片 → 定格成年轮 / 多重曝光
  const startLong = useCallback(async () => {
    if (longCancelRef.current) return
    if (captureCancelRef.current) {
      captureCancelRef.current()
      captureCancelRef.current = null
    }
    setCapturePhase('idle')
    setUtterance(null)
    setLongSlices(null)
    resetVoiceSand()
    audioEngine.stop()
    if (micStatus !== 'listening') {
      actions.setMicStatus('requesting')
      try {
        await micInput.start()
      } catch (error) {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        actions.setMicStatus(denied ? 'denied' : 'unsupported')
        return
      }
      if (inputModeRef.current !== 'mic') return
      actions.setMicStatus('listening')
    }
    const samples: LongSoundSample[] = []
    const unsubscribe = micInput.subscribe((frame) => {
      samples.push({
        pitchHz: frame.pitchHz,
        volume: frame.volume,
        brightness: frame.brightness ?? 0.4,
        centroid: frame.centroid,
        harmonicRatio: frame.harmonicRatio,
      })
    })
    setLongPhase('recording')
    setLongElapsed(0)
    const startedAt = performance.now()
    const finish = () => {
      const duration = (performance.now() - startedAt) / 1000
      if (duration < LONG_MIN_SECONDS) return
      if (longCancelRef.current) {
        longCancelRef.current()
        longCancelRef.current = null
      }
      finishLongRef.current = null
      micInput.stop()
      actions.setMicStatus('idle')
      setMicEnergy(null)
      setMicWaveform(null)
      const slices = compressTimeline(samples, mapVoicePitch)
      if (!slices) {
        setLongPhase('idle')
        toast(t.longCapture.silent, 'warning')
        return
      }
      let loudSum = 0
      let loudCount = 0
      for (const s of samples) {
        if (s.volume > 0.05) {
          loudSum += s.volume
          loudCount += 1
        }
      }
      const loudness = loudCount > 0 ? loudSum / loudCount : 0
      setFrozenEnergy(0.05 + 0.12 * Math.min(1, loudness * 1.8))
      setLongSlices(slices)
      setLongDuration(duration)
      setCompressionMode('rings')
      setLongPhase('frozen')
      sandRef.current?.scatter()
    }
    finishLongRef.current = finish
    const ticker = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000
      if (elapsed >= LONG_MAX_SECONDS) finish()
      else setLongElapsed(elapsed)
    }, 100)
    longCancelRef.current = () => {
      window.clearInterval(ticker)
      unsubscribe()
    }
  }, [micStatus, micInput, audioEngine, actions, mapVoicePitch, toast, resetVoiceSand])

  const handleFinishLong = useCallback(() => {
    finishLongRef.current?.()
  }, [])

  const handleModeChange = (mode: InputMode) => {
    actions.setInputMode(mode)
  }

  const handlePlateShape = (shape: PlateShape) => {
    setPlateShape(shape)
  }

  // 子组件 SandCanvas 的 effect 先按新盘形重撒，这里再 scatter 让沙粒立刻重新排队；
  // 切换材质也轻散一次，让新介质的物理笔触立刻显形
  useEffect(() => {
    sandRef.current?.scatter()
  }, [plateShape, medium])

  const handleCommit = (hz: number) => {
    audioEngine.playTone(hz, { timbre, chord })
    sandRef.current?.scatter()
  }

  const handleTimbreChange = (value: number) => {
    setTimbre(value)
  }

  const handleTimbreCommit = (value: number) => {
    audioEngine.playTone(frequencyHz, { timbre: value, chord })
  }

  const handleChordChange = (next: ResonanceChord) => {
    setChord(next)
    audioEngine.playTone(frequencyHz, { timbre, chord: next })
  }

  const currentDensity = inputMode === 'mic' && theme === 'voice' ? voiceDensity : 1

  const captureReplayMeta = (state: ArrayBuffer): ReplayMeta => ({
    density: currentDensity,
    energy,
    activeColorBand: colorBand,
    count: new DataView(state).getUint32(4, true),
    frequencyHz,
  })

  const handleDownload = async () => {
    if (busy) return
    setBusy('download')
    try {
      const state = sandRef.current?.exportState() ?? null
      const image = (await sandRef.current?.snapshotScaled(600)) ?? null
      const snapshot = (await sandRef.current?.snapshot()) ?? null
      if (!state || !image) {
        toast(t.captureFailedToast, 'warning')
        return
      }
      const title = t.defaultTitle(frequencyHz)
      const artwork: Artwork = {
        id: crypto.randomUUID(),
        title,
        pattern,
        theme,
        author: author.trim() || t.anonymousAuthor,
        source: inputMode,
        frequencyHz,
        createdAt: Date.now(),
      }
      await artworkExporter.export(artwork, snapshot)
      try {
        await localGallery.save({ ...artwork, title, replayMeta: captureReplayMeta(state), image, state })
        actions.refreshGallery()
      } catch {
        // 本机收藏失败不影响下载
      }
      toast(t.downloadedToast, 'success')
    } finally {
      setBusy(null)
    }
  }

  const handlePublish = async (title: string) => {
    if (busy) return
    setBusy('publish')
    try {
      const state = sandRef.current?.exportState() ?? null
      const image = (await sandRef.current?.snapshotScaled(600)) ?? null
      if (!state || !image) {
        toast(t.captureFailedToast, 'warning')
        setPublishOpen(false)
        return
      }
      const authorName = author.trim() || t.anonymousAuthor
      const createdAt = Date.now()
      const replayMeta = captureReplayMeta(state)
      let id: string = crypto.randomUUID()
      let published = false
      try {
        const result = await galleryService.publish(
          { title, author: authorName, theme, source: inputMode, frequencyHz, pattern, replayMeta },
          image,
          state,
        )
        id = result.id
        published = true
      } catch (error) {
        const code = error instanceof GalleryError ? error.code : 'network_error'
        toast(code === 'gallery_full' ? t.galleryFullToast : t.publishFailedToast, 'warning')
      }
      try {
        await localGallery.save({
          id,
          title,
          author: authorName,
          theme,
          source: inputMode,
          frequencyHz,
          pattern,
          replayMeta,
          createdAt,
          image,
          state,
        })
      } catch {
        // 本机收藏失败不影响发布结果
      }
      // 无论公共发布成败，本机展厅都已写入；发布成功时公共展厅也需刷新
      actions.refreshGallery()
      if (published) {
        toast(t.publishedToast, 'success')
        setPublishOpen(false)
      }
    } finally {
      setBusy(null)
    }
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
            <div className={styles.stageCanvas}>
              <SandCanvas
                ref={sandRef}
                pattern={pattern}
                theme={theme}
                energy={energy}
                interactive
                density={inputMode === 'mic' && theme === 'voice' ? voiceDensity : 1}
                activeColorBand={colorBand}
              />
              <div
                className={styles.sandTools}
                role="group"
                aria-label={t.sandToolsAria}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className={styles.sandTool}
                  aria-label={t.scatterAria}
                  disabled={longPhase !== 'idle'}
                  onClick={() => sandRef.current?.scatter()}
                >
                  {t.scatterLabel}
                </button>
              </div>
            </div>
            <div className={`mono ${styles.status}`} aria-live="polite">
              {longPhase === 'recording' ? (
                <>
                  <span className={styles.eq} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className={styles.statusText}>{t.longCapture.statusRecording}</span>
                </>
              ) : longPhase === 'frozen' ? (
                <>
                  <SpeakerIcon size={13} className={styles.statusIcon} />
                  <span className={styles.statusText}>{t.longCapture.statusFrozen}</span>
                </>
              ) : listening ? (
                <>
                  <span className={styles.eq} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className={styles.statusText}>{t.statusListening(description)}</span>
                </>
              ) : capturePhase === 'done' && utterance ? (
                <>
                  <SpeakerIcon size={13} className={styles.statusIcon} />
                  <span className={styles.statusText}>{t.captureDone}</span>
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
              <>
                <FrequencySlider
                  value={frequencyHz}
                  onChange={actions.setFrequency}
                  onCommit={handleCommit}
                />
                <TimbreSlider
                  value={timbre}
                  onChange={handleTimbreChange}
                  onCommit={handleTimbreCommit}
                />
                <ChordSelector value={chord} onChange={handleChordChange} />
              </>
            ) : (
              <MicPanel
                status={micStatus}
                capturePhase={capturePhase}
                secondsLeft={secondsLeft}
                report={utterance?.report ?? null}
                longPhase={longPhase}
                longElapsed={longElapsed}
                longDuration={longDuration}
                compressionMode={compressionMode}
                onStart={handleRealtimeStart}
                onStop={stopMic}
                onCapture={() => {
                  void startCapture()
                }}
                onStartLong={() => {
                  void startLong()
                }}
                onFinishLong={handleFinishLong}
                onCompressionModeChange={setCompressionMode}
                onResetLong={resetLong}
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

          <ConsoleGroup index="03" title={t.groupPlate} en={t.groupPlateEn}>
            <PlateShapePicker value={plateShape} onChange={handlePlateShape} />
          </ConsoleGroup>

          <ConsoleGroup index="04" title={t.themeLabel} en={t.groupPaletteEn}>
            <ParticleThemePicker value={theme} onChange={actions.setTheme} />
          </ConsoleGroup>

          <ConsoleGroup index="05" title={t.mediumLabel} en={t.groupMediumEn}>
            <MediumPicker value={medium} onChange={setMedium} />
          </ConsoleGroup>

          <ConsoleGroup index="06" title={t.groupSignature} en={t.groupSignatureEn}>
            <SignatureForm
              author={author}
              onAuthorChange={actions.setAuthor}
              onDownload={() => void handleDownload()}
              onPublish={() => setPublishOpen(true)}
              busy={busy}
            />
          </ConsoleGroup>
        </div>
      </div>

      {publishOpen && (
        <PublishDialog
          defaultTitle={t.defaultTitle(frequencyHz)}
          busy={busy === 'publish'}
          onCancel={() => setPublishOpen(false)}
          onConfirm={(title) => void handlePublish(title)}
        />
      )}
    </Section>
  )
}
