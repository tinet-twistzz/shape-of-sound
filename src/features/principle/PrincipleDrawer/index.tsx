import { useEffect, useRef } from 'react'

import { Drawer } from '@/components/ui/Drawer'
import { copy } from '@/content/copy'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useScrollTo } from '@/hooks/useScrollTo'
import { useServices } from '@/services/serviceContext'
import { useAppActions, useAppState } from '@/store/appStateContext'
import type { SectionId } from '@/types/domain'

import { PrincipleContent } from './PrincipleContent'
import styles from './PrincipleDrawer.module.css'

const DRAWER_EXIT_MS = 320

/** 「声形之理」手册抽屉：宽屏右侧 60%，手机全屏 */
export function PrincipleDrawer() {
  const { principle } = useAppState()
  const actions = useAppActions()
  const { dataSource } = useServices()
  const chapters = useAsyncData(() => dataSource.getPrincipleChapters(), [dataSource])
  const scrollTo = useScrollTo()
  const jumpTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(jumpTimer.current), [])

  const handleGoToSection = (section: SectionId) => {
    actions.closePrinciple()
    window.clearTimeout(jumpTimer.current)
    // 等抽屉退场、页面滚动解锁后再跳转，避免焦点归还把页面拉回原处
    jumpTimer.current = window.setTimeout(() => scrollTo(section), DRAWER_EXIT_MS)
  }

  return (
    <Drawer
      open={principle.open}
      onClose={actions.closePrinciple}
      title={copy.principle.drawerTitle}
      subtitle={copy.principle.drawerSubtitle}
      className={styles.drawer}
    >
      {chapters.loading && <p className="caption">{copy.hints.loading}</p>}
      {chapters.error && <p className="caption">{copy.hints.loadError}</p>}
      {chapters.data && (
        <PrincipleContent
          chapters={chapters.data}
          targetChapterId={principle.chapterId}
          onGoToSection={handleGoToSection}
        />
      )}
    </Drawer>
  )
}
