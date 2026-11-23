import { useCallback, useEffect, useRef, useState } from 'react'

import { Section } from '@/components/layout/Section'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { SegmentedOption } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui/Toast/toastContext'
import { copy } from '@/content/copy'
import { useScrollTo } from '@/hooks/useScrollTo'
import { localGallery } from '@/services/real/localGallery'
import type { LocalArtwork } from '@/services/real/localGallery'
import { useServices } from '@/services/serviceContext'
import { useAppState } from '@/store/appStateContext'
import type { ExhibitionArtwork } from '@/types/services'

import { ArtworkCard } from '../ArtworkCard'
import { ReplayModal } from '../ReplayModal'
import type { ReplayWork } from '../replayWork'

import styles from './ExhibitionSection.module.css'

const t = copy.sections.exhibition

// 与 functions/routes.mjs 的 PAGE 保持一致
const PAGE_SIZE = 20

type Tab = 'public' | 'mine'
type LoadStatus = 'loading' | 'ready' | 'error'

const TAB_OPTIONS: readonly SegmentedOption<Tab>[] = [
  { value: 'public', label: t.tabPublic },
  { value: 'mine', label: t.tabMine },
]

/** HALL 04 · 艺术展厅：公共展厅（云端）与我的展厅（本机 IndexedDB） */
export function ExhibitionSection() {
  const { galleryService } = useServices()
  const { galleryVersion } = useAppState()
  const toast = useToast()
  const scrollTo = useScrollTo()

  const [tab, setTab] = useState<Tab>('public')
  const [items, setItems] = useState<ExhibitionArtwork[]>([])
  const [publicStatus, setPublicStatus] = useState<LoadStatus>('loading')
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [paging, setPaging] = useState(false)
  const [mineState, setMineState] = useState<{ status: LoadStatus; records: LocalArtwork[] }>({
    status: 'loading',
    records: [],
  })
  const [mineUrls, setMineUrls] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [active, setActive] = useState<ReplayWork | null>(null)
  const reqIdRef = useRef(0)

  useEffect(
    () => () => {
      reqIdRef.current += 1
    },
    [],
  )

  const loadPublic = useCallback(async () => {
    const reqId = ++reqIdRef.current
    setPaging(false)
    setPublicStatus('loading')
    try {
      const first = await galleryService.list(0)
      if (reqId !== reqIdRef.current) return
      setItems(first.items)
      setHasMore(first.hasMore)
      setPage(1)
      setPublicStatus('ready')
    } catch {
      if (reqId !== reqIdRef.current) return
      setPublicStatus('error')
    }
  }, [galleryService])

  const loadMine = useCallback(async () => {
    setMineState((prev) => (prev.records.length === 0 ? { ...prev, status: 'loading' } : prev))
    try {
      const records = await localGallery.list()
      setMineState({ status: 'ready', records })
    } catch {
      setMineState((prev) => ({ ...prev, status: 'error' }))
    }
  }, [])

  useEffect(() => {
    if (tab === 'public') void loadPublic()
    else void loadMine()
  }, [tab, loadPublic, loadMine])

  // 工坊发布/收藏后 galleryVersion 自增，两个展厅都重新拉取，确保新作品立即可见
  useEffect(() => {
    if (galleryVersion === 0) return
    void loadPublic()
    void loadMine()
  }, [galleryVersion, loadPublic, loadMine])

  useEffect(() => {
    const urls = new Map(mineState.records.map((r) => [r.id, URL.createObjectURL(r.image)]))
    setMineUrls(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [mineState.records])

  const goToPage = async (target: number) => {
    if (paging || target < 1 || target === page) return
    const reqId = ++reqIdRef.current
    setPaging(true)
    try {
      const result = await galleryService.list((target - 1) * PAGE_SIZE)
      if (reqId !== reqIdRef.current) return
      setItems(result.items)
      setHasMore(result.hasMore)
      setPage(target)
      scrollTo('exhibition')
    } catch {
      if (reqId !== reqIdRef.current) return
      toast(copy.hints.loadError, 'warning')
    } finally {
      if (reqId === reqIdRef.current) {
        setPaging(false)
      }
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
      setMineState((prev) => ({
        ...prev,
        records: prev.records.filter((r) => r.id !== id),
      }))
      toast(t.removedToast, 'info')
    } catch {
      toast(t.removeFailedToast, 'danger')
    }
  }

  const goStudio = () => scrollTo('studio')

  return (
    <Section id="exhibition">
      <SectionHeader index={t.hallIndex} title={t.title} caption={t.caption} />

      <div className={styles.tabs}>
        <SegmentedControl
          options={TAB_OPTIONS}
          value={tab}
          onChange={setTab}
          ariaLabel={t.tabsAria}
        />
      </div>

      {tab === 'public' && (
        <div className={styles.body}>
          {publicStatus === 'loading' && (
            <p className={`mono ${styles.status}`}>{copy.hints.loading}</p>
          )}
          {publicStatus === 'error' && (
            <div className={styles.notice}>
              <p className={styles.statusText}>{copy.hints.loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void loadPublic()}>
                {copy.buttons.retry}
              </Button>
            </div>
          )}
          {publicStatus === 'ready' && items.length === 0 && page === 1 && (
            <div className={styles.notice}>
              <p className={styles.statusText}>{t.publicEmpty}</p>
              <Button variant="outline" size="sm" onClick={goStudio}>
                {t.goStudio}
              </Button>
            </div>
          )}
          {publicStatus === 'ready' && (items.length > 0 || page > 1) && (
            <>
              <div className={styles.grid}>
                {items.map((item, index) => (
                  <ArtworkCard
                    key={item.id}
                    title={item.title}
                    author={item.author}
                    theme={item.theme}
                    imageUrl={item.imageUrl}
                    order={(page - 1) * PAGE_SIZE + index + 1}
                    onOpen={() => openPublic(item)}
                  />
                ))}
              </div>
              {(page > 1 || hasMore) && (
                <div className={styles.pager}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paging || page === 1}
                    onClick={() => void goToPage(page - 1)}
                  >
                    {t.prevPage}
                  </Button>
                  <span className={`mono ${styles.pageIndicator}`} aria-live="polite">
                    {paging ? t.paging : t.pageIndicator(page)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paging || !hasMore}
                    onClick={() => void goToPage(page + 1)}
                  >
                    {t.nextPage}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className={styles.body}>
          {mineState.status === 'loading' && (
            <p className={`mono ${styles.status}`}>{copy.hints.loading}</p>
          )}
          {mineState.status === 'error' && (
            <div className={styles.notice}>
              <p className={styles.statusText}>{t.mineUnavailable}</p>
            </div>
          )}
          {mineState.status === 'ready' && mineState.records.length === 0 && (
            <div className={styles.notice}>
              <p className={styles.statusText}>{t.mineEmpty}</p>
              <Button variant="outline" size="sm" onClick={goStudio}>
                {t.goStudio}
              </Button>
            </div>
          )}
          {mineState.status === 'ready' && mineState.records.length > 0 && (
            <>
              <div className={styles.grid}>
                {mineState.records.map((record, index) => (
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
