import { useEffect, useMemo, useRef, useState } from 'react'

import { Section } from '@/components/layout/Section'
import { SandCanvas } from '@/components/sand/SandCanvas'
import type { SandCanvasHandle } from '@/components/sand/SandCanvas'
import { Button } from '@/components/ui/Button'
import { ExhibitLabel } from '@/components/ui/ExhibitLabel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Tag } from '@/components/ui/Tag'
import { QuestionIcon, SoundExhibitIcon, SpeakerIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useServices } from '@/services/serviceContext'
import { useAppActions, useAppState } from '@/store/appStateContext'
import type { SoundPreset } from '@/types/domain'

import { SoundPresetGrid } from '../SoundPresetGrid'
import { PITCH_META } from '../pitchMeta'

import styles from './GallerySection.module.css'

/** mock 演奏时长：期间沙盘旁显示「正在演奏」读数 */
const PLAYING_MS = 1400

function GallerySkeleton() {
  return (
    <div className={styles.layout} aria-hidden="true">
      <div>
        <div className={`${styles.skeleton} ${styles.skeletonCanvas}`} />
        <div className={`${styles.skeleton} ${styles.skeletonStatus}`} />
      </div>
      <div className={styles.exhibits}>
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />
          ))}
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
        <p className={`caption ${styles.loadingHint}`}>{copy.hints.loading}</p>
      </div>
    </div>
  )
}

/** HALL 01 · 声形画廊：左沙盘，右声音展品 + 展签 */
export function GallerySection() {
  const { dataSource, audioEngine } = useServices()
  const { selectedSoundId } = useAppState()
  const actions = useAppActions()
  const [retryKey, setRetryKey] = useState(0)
  const presets = useAsyncData(() => dataSource.getSoundPresets(), [dataSource, retryKey])
  const sandRef = useRef<SandCanvasHandle>(null)
  const playTimer = useRef<number | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const list = presets.data
  const selected = useMemo(() => {
    if (!list || list.length === 0) return null
    return list.find((preset) => preset.id === selectedSoundId) ?? list[0]
  }, [list, selectedSoundId])

  // 默认选中第一件展品
  useEffect(() => {
    if (list && list.length > 0 && !list.some((preset) => preset.id === selectedSoundId)) {
      actions.selectSound(list[0].id)
    }
  }, [list, selectedSoundId, actions])

  useEffect(
    () => () => {
      if (playTimer.current !== null) window.clearTimeout(playTimer.current)
    },
    [],
  )

  const handleSelect = (preset: SoundPreset) => {
    actions.selectSound(preset.id)
    audioEngine.play(preset)
    sandRef.current?.scatter()
    setPlayingId(preset.id)
    if (playTimer.current !== null) window.clearTimeout(playTimer.current)
    playTimer.current = window.setTimeout(() => setPlayingId(null), PLAYING_MS)
  }

  const selectedIndex = selected && list ? list.findIndex((p) => p.id === selected.id) : -1
  const playing = selected !== null && playingId === selected.id
  const pitch = selected ? PITCH_META[selected.pitchLevel] : null

  return (
    <Section id="gallery">
      <SectionHeader
        index={copy.sections.gallery.hallIndex}
        title={copy.sections.gallery.title}
        caption={copy.sections.gallery.caption}
        action={
          <Button variant="ghost" size="sm" onClick={() => actions.openPrinciple('sand-haven')}>
            <QuestionIcon size={14} />
            {copy.principle.openLabel}
          </Button>
        }
      />

      {presets.loading && <GallerySkeleton />}

      {presets.error && (
        <div className={styles.errorPlate} role="alert">
          <span className={`mono ${styles.errorCode}`}>{copy.hints.errorCode}</span>
          <p className="caption">{copy.hints.loadError}</p>
          <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
            {copy.buttons.retry}
          </Button>
        </div>
      )}

      {list && list.length === 0 && (
        <div className={styles.errorPlate}>
          <p className="caption">{copy.hints.empty}</p>
        </div>
      )}

      {list && list.length > 0 && selected && pitch && (
        <div className={styles.layout}>
          <div className={styles.stage}>
            <div className={styles.stageSticky}>
              <SandCanvas
                ref={sandRef}
                pattern={selected.pattern}
                theme="gold"
                energy={pitch.energy}
                interactive
                className={styles.canvas}
              />
              <div className={`mono ${styles.status}`} aria-live="polite">
                {playing ? (
                  <>
                    <span className={styles.eq} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                    <SoundExhibitIcon
                      id={selected.id}
                      size={13}
                      className={styles.playingIcon}
                    />
                    <span className={styles.statusText}>
                      {copy.sections.gallery.playingStatus(selected.name)}
                    </span>
                  </>
                ) : (
                  <>
                    <SpeakerIcon size={13} className={styles.statusIcon} />
                    <span className={styles.statusText}>{copy.sections.gallery.playHint}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.exhibits}>
            <SoundPresetGrid presets={list} selectedId={selected.id} onSelect={handleSelect} />
            <ExhibitLabel
              key={selected.id}
              className={styles.label}
              code={copy.sections.gallery.exhibitCode(selectedIndex + 1)}
              title={
                <span className={styles.labelTitle}>
                  <SoundExhibitIcon id={selected.id} size={18} className={styles.labelIcon} />
                  {selected.name}
                </span>
              }
              rows={[
                {
                  label: copy.sections.gallery.rowPitch,
                  value: <Tag tone={pitch.tone}>{pitch.label}</Tag>,
                },
                { label: copy.sections.gallery.rowPattern, value: selected.patternName },
                {
                  label: copy.sections.gallery.rowMode,
                  value: `(n=${selected.pattern.n}, m=${selected.pattern.m})`,
                },
              ]}
              note={selected.description}
            />
          </div>
        </div>
      )}
    </Section>
  )
}
