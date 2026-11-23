import { useEffect } from 'react'

import { Footer } from '@/components/layout/Footer'
import { TopNav } from '@/components/layout/TopNav'
import { ExhibitionSection } from '@/features/exhibition/ExhibitionSection'
import { GallerySection } from '@/features/gallery/GallerySection'
import { HeroSection } from '@/features/hero/HeroSection'
import { PrincipleDrawer } from '@/features/principle/PrincipleDrawer'
import { QuizSection } from '@/features/quiz/QuizSection'
import { StudioSection } from '@/features/studio/StudioSection'
import { useScrollSpy } from '@/hooks/useScrollSpy'
import { useAppActions, useAppState } from '@/store/appStateContext'
import type { SectionId } from '@/types/domain'

import styles from './App.module.css'

const SECTION_IDS: readonly SectionId[] = ['hero', 'gallery', 'quiz', 'studio', 'exhibition']

export function App() {
  const { principle } = useAppState()
  const actions = useAppActions()
  const active = useScrollSpy(SECTION_IDS)

  useEffect(() => {
    actions.setCurrentSection(active)
  }, [active, actions])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'm' || event.key === 'M') {
        actions.toggleMute()
      } else if (event.key === '?') {
        if (principle.open) {
          actions.closePrinciple()
        } else if (!document.querySelector('[role="dialog"][aria-modal="true"]')) {
          actions.openPrinciple()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, principle.open])

  return (
    <div className={styles.page}>
      <TopNav />
      <main>
        <HeroSection />
        <GallerySection />
        <QuizSection />
        <StudioSection />
        <ExhibitionSection />
      </main>
      <Footer />
      <PrincipleDrawer />
    </div>
  )
}
