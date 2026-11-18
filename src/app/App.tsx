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
import { useAppActions } from '@/store/appStateContext'
import type { SectionId } from '@/types/domain'

import styles from './App.module.css'

const SECTION_IDS: readonly SectionId[] = ['hero', 'gallery', 'quiz', 'studio', 'exhibition']

export function App() {
  const actions = useAppActions()
  const active = useScrollSpy(SECTION_IDS)

  useEffect(() => {
    actions.setCurrentSection(active)
  }, [active, actions])

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
