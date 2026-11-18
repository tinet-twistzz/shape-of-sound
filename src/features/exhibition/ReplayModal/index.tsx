import { useEffect, useRef, useState } from 'react'

import { SandCanvas } from '@/components/sand/SandCanvas'
import type { SandCanvasHandle } from '@/components/sand/SandCanvas'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { CameraIcon, CloseIcon, RefreshIcon } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast/toastContext'
import { copy } from '@/content/copy'
import { useServices } from '@/services/serviceContext'

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

/** 详情弹窗：灌入粒子状态让画作从静止原貌继续仿真；失败降级为快照 */
export function ReplayModal({ work, onClose }: ReplayModalProps) {
  const { artworkExporter } = useServices()
  const toast = useToast()
  const sandRef = useRef<SandCanvasHandle>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [downloading, setDownloading] = useState(false)

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
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

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

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={`《${work.title}》 · ${work.author}`}
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
          <IconButton label={t.closeLabel} variant="ghost" size="sm" onClick={onClose}>
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
          <Button
            variant="outline"
            disabled={phase !== 'live'}
            onClick={() => sandRef.current?.scatter()}
          >
            <RefreshIcon size={15} />
            {t.scatterLabel}
          </Button>
          <Button variant="primary" disabled={downloading} onClick={() => void handleDownload()}>
            <CameraIcon size={15} />
            {downloading ? t.downloading : t.downloadLabel}
          </Button>
        </footer>
      </div>
    </div>
  )
}