import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { SandCanvas } from '@/components/sand/SandCanvas'
import type { SandCanvasHandle } from '@/components/sand/SandCanvas'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import {
  ArrowRightIcon,
  CameraIcon,
  CloseIcon,
  RefreshIcon,
  SpeakerIcon,
} from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast/toastContext'
import { copy } from '@/content/copy'
import { useModalLayer } from '@/hooks/useModalLayer'
import { useScrollTo } from '@/hooks/useScrollTo'
import { modeToCenterHz } from '@/services/real/chladniPatternMapper'
import { useServices } from '@/services/serviceContext'
import { useAppActions } from '@/store/appStateContext'
import type { PatternParams, ResonanceChord } from '@/types/domain'
import type { ToneOptions } from '@/types/services'

import type { ReplayWork } from '../replayWork'

import styles from './ReplayModal.module.css'

const t = copy.sections.exhibition

export interface ReplayModalProps {
  work: ReplayWork
  onClose: () => void
}

type Phase = 'loading' | 'live' | 'fallback'

function formatDate(ms: number): string {
  const d = new Date(ms)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

function inferToneFromPattern(pattern: PatternParams): Required<ToneOptions> {
  let chord: ResonanceChord = 'solo'
  const sec = pattern.secondary
  if (!sec && Math.abs(pattern.twist ?? 0) >= 0.4) {
    chord = 'vortex'
  } else if (sec) {
    if (Math.abs(sec.weight - 0.38) < 0.025) {
      chord = 'octave'
    } else if (Math.abs(sec.weight - 0.32) < 0.025) {
      chord = 'third'
    } else if (Math.abs(sec.weight - 0.45) < 0.03) {
      chord = 'fifth'
    } else {
      const ratio = (sec.n / Math.max(1, pattern.n) + sec.m / Math.max(1, pattern.m)) / 2
      chord = ratio >= 1.75 ? 'octave' : ratio >= 1.38 ? 'fifth' : 'third'
    }
  }
  const bOffset = chord === 'third' ? 0.18 : 0
  const rawTimbre = -((pattern.b ?? -1) - bOffset) / 1.25
  const timbre = Math.max(-1, Math.min(1, Math.round(rawTimbre * 100) / 100))
  return { timbre, chord }
}

/** 详情弹窗：灌入粒子状态让画作从静止原貌继续仿真；失败降级为快照 */
export function ReplayModal({ work, onClose }: ReplayModalProps) {
  const { artworkExporter, audioEngine } = useServices()
  const actions = useAppActions()
  const scrollTo = useScrollTo()
  const toast = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const sandRef = useRef<SandCanvasHandle>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [downloading, setDownloading] = useState(false)

  const { handleKeyDown } = useModalLayer(panelRef, {
    open: true,
    onClose,
    closable: !downloading,
  })

  const toneOptions = useMemo(() => inferToneFromPattern(work.pattern), [work.pattern])
  const freqHz = useMemo(
    () => work.frequencyHz || modeToCenterHz(work.pattern.n, work.pattern.m),
    [work.frequencyHz, work.pattern.n, work.pattern.m],
  )

  useEffect(() => {
    let cancelled = false
    work
      .getState()
      .then((buffer) => {
        if (cancelled) return
        if (buffer && sandRef.current?.loadState(buffer)) setPhase('live')
        else setPhase('fallback')
      })
      .catch(() => {
        if (!cancelled) setPhase('fallback')
      })
    return () => {
      cancelled = true
    }
  }, [work])

  useEffect(() => {
    if (phase !== 'live') return
    audioEngine.playTone(freqHz, toneOptions)
  }, [phase, freqHz, toneOptions, audioEngine])

  useEffect(
    () => () => {
      audioEngine.stop()
    },
    [audioEngine],
  )

  const handleListen = () => {
    audioEngine.playTone(freqHz, toneOptions)
    if (phase === 'live') {
      sandRef.current?.scatter()
    }
  }

  const handleRemix = () => {
    audioEngine.stop()
    actions.loadIntoStudio({
      frequencyHz: freqHz,
      theme: work.theme,
      plateShape: work.pattern.plateShape ?? 'square',
      medium: work.pattern.medium ?? 'sand',
      timbre: toneOptions.timbre,
      chord: toneOptions.chord,
    })
    onClose()
    toast(t.remixToast(work.title), 'info')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollTo('studio'))
    })
  }

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      let snapshot: Blob | null = null
      if (phase === 'live') {
        snapshot = (await sandRef.current?.snapshot()) ?? null
      }
      if (!snapshot) {
        try {
          const response = await fetch(work.imageUrl)
          if (response.ok) snapshot = await response.blob()
        } catch {
          // 快照也拿不到时导出无图典藏卡
        }
      }
      await artworkExporter.export(
        {
          id: work.id,
          title: work.title,
          pattern: work.pattern,
          theme: work.theme,
          author: work.author,
          source: work.source,
          frequencyHz: work.frequencyHz,
          createdAt: work.createdAt,
        },
        snapshot,
      )
      toast(t.downloadedToast, 'success')
    } finally {
      setDownloading(false)
    }
  }

  // Section 入场动画保留 transform，fixed 弹层会以其为定位基准；挂到 body 才能视口居中
  return createPortal(
    <div className={styles.overlay} role="presentation" onClick={downloading ? undefined : onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={`《${work.title}》 · ${work.author}`}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.head}>
          <div className={styles.headText}>
            <span className={`mono ${styles.code}`}>
              {copy.sections.studio.themes[work.theme]} · {Math.round(work.frequencyHz)} HZ
            </span>
            <h3 className={`display ${styles.title}`}>《{work.title}》</h3>
            <p className={styles.author}>
              {work.author} · {formatDate(work.createdAt)}
            </p>
          </div>
          <IconButton
            label={t.closeLabel}
            variant="ghost"
            size="sm"
            disabled={downloading}
            onClick={onClose}
          >
            <CloseIcon size={16} />
          </IconButton>
        </header>

        <div className={styles.stage}>
          {phase === 'fallback' ? (
            <img className={styles.fallback} src={work.imageUrl} alt={`《${work.title}》快照`} />
          ) : (
            <SandCanvas
              ref={sandRef}
              pattern={work.pattern}
              theme={work.theme}
              energy={work.replayMeta.energy}
              interactive
              density={1}
              activeColorBand={work.replayMeta.activeColorBand}
              className={styles.canvas}
            />
          )}
          {phase === 'loading' && (
            <div className={`mono ${styles.loading}`} aria-live="polite">
              {t.replayLoading}
            </div>
          )}
        </div>

        <p className={`mono ${styles.hint}`} aria-live="polite">
          {phase === 'fallback' ? t.replayFallback : t.replayHint}
        </p>

        <footer className={styles.actions}>
          <Button variant="outline" size="sm" aria-label={t.listenAria} onClick={handleListen}>
            <SpeakerIcon size={14} />
            {t.listenLabel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={phase !== 'live'}
            onClick={() => sandRef.current?.scatter()}
          >
            <RefreshIcon size={14} />
            {t.scatterLabel}
          </Button>
          <Button variant="cyan" size="sm" onClick={handleRemix}>
            <ArrowRightIcon size={14} />
            {t.remixLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            <CameraIcon size={14} />
            {downloading ? t.downloading : t.downloadLabel}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
