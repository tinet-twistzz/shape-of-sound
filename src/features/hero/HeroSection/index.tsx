import { SandCanvas } from '@/components/sand/SandCanvas'
import { Button } from '@/components/ui/Button'
import { ArrowRightIcon, BookIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useScrollTo } from '@/hooks/useScrollTo'
import { useServices } from '@/services/serviceContext'
import { useAppActions } from '@/store/appStateContext'
import type { PatternParams } from '@/types/domain'

import styles from './HeroSection.module.css'

const FALLBACK_PATTERN: PatternParams = { n: 1, m: 2 }
const BACKGROUND_ENERGY = 0.22

/** 序厅：全屏沙盘背景 + 渐变遮罩 + 依次入场的展签式文案 */
export function HeroSection() {
  const scrollTo = useScrollTo()
  const actions = useAppActions()
  const { dataSource } = useServices()
  const presets = useAsyncData(() => dataSource.getSoundPresets(), [dataSource])
  const backgroundPattern = presets.data?.[0]?.pattern ?? FALLBACK_PATTERN

  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.background} aria-hidden="true">
        <SandCanvas
          pattern={backgroundPattern}
          theme="gold"
          energy={BACKGROUND_ENERGY}
          frameless
          className={styles.sand}
        />
        <div className={styles.scrim} />
      </div>

      <div className={styles.content}>
        <span className={`hall-index ${styles.rise} ${styles.d1}`}>{copy.hero.hallIndex}</span>
        <h1 className={`display ${styles.title} ${styles.rise} ${styles.d2}`}>
          {copy.hero.title}
          <span className={styles.titleEn}>{copy.hero.titleEn}</span>
        </h1>
        <p className={`${styles.subtitle} ${styles.rise} ${styles.d3}`}>{copy.hero.subtitle}</p>
        <p className={`caption ${styles.intro} ${styles.rise} ${styles.d4}`}>{copy.hero.intro}</p>
        <div className={`${styles.cta} ${styles.rise} ${styles.d5}`}>
          <Button size="lg" onClick={() => scrollTo('gallery')}>
            {copy.hero.ctaPrimary}
            <ArrowRightIcon size={16} />
          </Button>
          <Button variant="outline" size="lg" onClick={() => actions.openPrinciple()}>
            <BookIcon size={16} />
            {copy.hero.ctaPrinciple}
          </Button>
        </div>
      </div>

      <button
        type="button"
        className={`${styles.scrollHint} ${styles.rise} ${styles.d6}`}
        onClick={() => scrollTo('gallery')}
      >
        <span className={`mono ${styles.scrollHintText}`}>{copy.hero.scrollHint}</span>
        <span className={styles.scrollLine} aria-hidden="true" />
      </button>
    </section>
  )
}
