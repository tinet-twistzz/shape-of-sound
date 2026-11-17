import { useCallback, useEffect, useRef, useState } from 'react'

import { PrincipleChapterView } from '@/features/principle/PrincipleChapterView'
import { PrincipleNav } from '@/features/principle/PrincipleNav'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { PrincipleChapter, SectionId } from '@/types/domain'

import styles from './PrincipleDrawer.module.css'

const ACTIVE_THRESHOLD_PX = 150

interface PrincipleContentProps {
  chapters: PrincipleChapter[]
  targetChapterId: string | null
  onGoToSection: (section: SectionId) => void
}

/** 抽屉内容：挂载时定位到目标章节，滚动时同步目录高亮 */
function PrincipleContent({ chapters, targetChapterId, onGoToSection }: PrincipleContentProps) {
  const reduced = useReducedMotion()
  const layoutRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState(() =>
    targetChapterId && chapters.some((chapter) => chapter.id === targetChapterId)
      ? targetChapterId
      : chapters[0].id,
  )

  const jumpTo = useCallback(
    (chapterId: string, smooth: boolean) => {
      document.getElementById(`principle-${chapterId}`)?.scrollIntoView({
        behavior: smooth && !reduced ? 'smooth' : 'auto',
        block: 'start',
      })
    },
    [reduced],
  )

  // 打开时如有 chapterId 自动滚动到对应章节
  useEffect(() => {
    const container = layoutRef.current?.parentElement
    const raf = requestAnimationFrame(() => {
      if (targetChapterId && chapters.some((chapter) => chapter.id === targetChapterId)) {
        jumpTo(targetChapterId, false)
      } else {
        container?.scrollTo({ top: 0 })
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [chapters, targetChapterId, jumpTo])

  // 滚动监听：当前章节高亮
  useEffect(() => {
    const container = layoutRef.current?.parentElement
    if (!container) return
    let raf = 0
    const update = () => {
      raf = 0
      const containerTop = container.getBoundingClientRect().top
      let current = chapters[0].id
      for (const chapter of chapters) {
        const element = document.getElementById(`principle-${chapter.id}`)
        if (element && element.getBoundingClientRect().top - containerTop <= ACTIVE_THRESHOLD_PX) {
          current = chapter.id
        }
      }
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
        current = chapters[chapters.length - 1].id
      }
      setActiveId(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [chapters])

  const handleJump = (chapterId: string) => {
    setActiveId(chapterId)
    jumpTo(chapterId, true)
  }

  return (
    <div ref={layoutRef} className={styles.layout}>
      <PrincipleNav chapters={chapters} activeId={activeId} onJump={handleJump} />
      <div className={styles.chapters}>
        {chapters.map((chapter, index) => (
          <PrincipleChapterView
            key={chapter.id}
            chapter={chapter}
            index={index}
            onGoToSection={onGoToSection}
          />
        ))}
      </div>
    </div>
  )
}

export { PrincipleContent }
