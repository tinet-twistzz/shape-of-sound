import { useCallback, useEffect, useMemo, useState } from 'react'

import { Section } from '@/components/layout/Section'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useToast } from '@/components/ui/Toast/toastContext'
import { copy } from '@/content/copy'
import { useScrollTo } from '@/hooks/useScrollTo'
import { localGallery } from '@/services/real/localGallery'
import type { LocalArtwork } from '@/services/real/localGallery'
import { useServices } from '@/services/serviceContext'
import type { ExhibitionArtwork } from '@/types/services'

import { ArtworkCard } from '../ArtworkCard'
import { ReplayModal } from '../ReplayModal'
import type { ReplayWork } from '../replayWork'

import styles from './ExhibitionSection.module.css'

const t = copy.sections.exhibition

type Tab = 'public' | 'mine'
type LoadStatus = 'loading' | 'ready' | 'error'

/** HALL 04 · 艺术展厅：公共展厅（云端）与我的展厅（本机 IndexedDB） */
export function ExhibitionSection() {
  const { galleryService } = useServices()
  const toast = useToast()
  const scrollTo = useScrollTo()

  const [tab, setTab] = useState<Tab>('public')
  const [items, setItems] = useState<ExhibitionArtwork[]>([])
  const [publicStatus, setPublicStatus] = useState<LoadStatus>('loading')
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [records, setRecords] = useState<LocalArtwork[]>([])
  const [mineStatus, setMineStatus] = useState<LoadStatus>('loading')
  const [active, setActive] = useState<ReplayWork | null>(null)

  const loadPublic = useCallback(async () => {
    setPublicStatus('loading')
    try {
      const page = await galleryService.list(0)
      setItems(page.items)
      setHasMore(page.hasMore)
      setNextOffset(page.nextOffset)
      setPublicStatus('ready')
    } catch {
      setPublicStatus('error')
    }
  }, [galleryService])

  const loadMine = useCallback(async () => {
    setMineStatus('loading')
    try {
      setRecords(await localGallery.list())
      setMineStatus('ready')
    } catch {
      setMineStatus('error')
    }
  }, [])

  useEffect(() => {
    if (tab === 'public') void loadPublic()
    else void loadMine()
  }, [tab, loadPublic, loadMine])

  const mineUrls = useMemo(
    () => new Map(records.map((r) => [r.id, URL.createObjectURL(r.image)])),
    [records],
  )
  useEffect(
    () => () => {
      mineUrls.forEach((url) => URL.revokeObjectURL(url))
    },
    [mineUrls],
  )

  const loadMore = async () => {
    if (nextOffset === null || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await galleryService.list(nextOffset)
      setItems((prev) => [...prev, ...page.items])
      setHasMore(page.hasMore)
      setNextOffset(page.nextOffset)
    } catch {
      toast(copy.hints.loadError, 'warning')
    } finally {
      setLoadingMore(false)
    }
  }

  const openPublic = (item: ExhibitionArtwork) => {
    setActive({
      ...item,
      getState: async () => {
        const detail = await galleryService.detail(item.id)
        const response = await fetch(detail.stateUrl)
        if (!response.ok) return null
        return response.arrayBuffer()
      },
    })
  }

  const openMine = (record: LocalArtwork) => {
    setActive({
      id: record.id,
      title: record.title,
      author: record.author,
      theme: record.theme,
      source: record.source,
      frequencyHz: record.frequencyHz,
      pattern: record.pattern,
      replayMeta: record.replayMeta,
      createdAt: record.createdAt,
      imageUrl: mineUrls.get(record.id) ?? '',
      getState: async () => record.state,
    })
  }

  const handleRemove = async (id: string) => {
    try {
      await localGallery.remove(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      toast(t.removedToast, 'info')
    } catch {
      toast(t.removeFailedToast, 'danger')
    }
  }

  const goStudio = () => scrollTo('studio')

  return (
    <Section id="exhibition">
      <SectionHeader index={t.hallIndex} title={t.title} caption={t.caption} />

      <div className={styles.tabs} role="tablist" aria-label={t.tabsAria}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'public'}
          className={[styles.tab, tab === 'public' && styles.tabActive].filter(Boolean).join(' ')}
          onClick={() => setTab('public')}
        >
          {t.tabPublic}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={[styles.tab, tab === 'mine' && styles.tabActive].filter(Boolean).join(' ')}
          onClick={() => setTab('mine')}
        >
          {t.tabMine}
        </button>
      </div>

      {tab === 'public' && (
        <div className={styles.body}>
          {publicStatus === 'loading' && <p className={`mono ${styles.status}`}>{copy.hints.loading}</p>}
          {publicStatus === 'error' && (
            <div className={styles.notice}>
              <p className={styles.statusText}>{copy.hints.loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void loadPublic()}>
                {copy.buttons.retry}
              </Button>
            </div>
          )}
          {publicStatus === 'ready' && items.length === 0 && (
            <div className={styles.notice}>
              <p className={styles.statusText}>{t.publicEmpty}</p>
              <Button variant="outline" size="sm" onClick={goStudio}>
                {t.goStudio}
              </Button>
            </div>
          )}
          {publicStatus === 'ready' && items.length > 0 && (
            <>
              <div className={styles.grid}>
                {items.map((item, index) => (
                  <ArtworkCard
                    key={item.id}
                    title={item.title}
                    author={item.author}
                    theme={item.theme}
                    imageUrl={item.imageUrl}
                    order={index + 1}
                    onOpen={() => openPublic(item)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className={styles.more}>
                  <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
                    {loadingMore ? t.loadingMore : t.loadMore}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className={styles.body}>
          {mineStatus === 'loading' && <p className={`mono ${styles.status}`}>{copy.hints.loading}</p>}
          {mineStatus === 'error' && (
            <div className={styles.notice}>
              <p className={styles.statusText}>{t.mineUnavailable}</p>
            </div>
          )}
          {mineStatus === 'ready' && records.length === 0 && (
            <div className={styles.notice}>
              <p className={styles.statusText}>{t.mineEmpty}</p>
              <Button variant="outline" size="sm" onClick={goStudio}>
                {t.goStudio}
              </Button>
            </div>
          )}
          {mineStatus === 'ready' && records.length > 0 && (
            <>
              <div className={styles.grid}>
                {records.map((record, index) => (
                  <ArtworkCard
                    key={record.id}
                    title={record.title}
                    author={record.author}
                    theme={record.theme}
                    imageUrl={mineUrls.get(record.id) ?? ''}
                    order={index + 1}
                    onOpen={() => openMine(record)}
                    onRemove={() => void handleRemove(record.id)}
                  />
                ))}
              </div>
              <p className={`mono ${styles.mineNote}`}>{t.mineNote}</p>
            </>
          )}
        </div>
      )}

      {active && <ReplayModal work={active} onClose={() => setActive(null)} />}
    </Section>
  )
}