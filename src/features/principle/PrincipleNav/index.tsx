import { copy } from '@/content/copy'
import type { PrincipleChapter } from '@/types/domain'

import styles from './PrincipleNav.module.css'

export interface PrincipleNavProps {
  chapters: PrincipleChapter[]
  activeId: string
  onJump: (chapterId: string) => void
}

/** 章节目录：宽屏左侧竖排常驻，窄屏顶部横向滚动 */
export function PrincipleNav({ chapters, activeId, onJump }: PrincipleNavProps) {
  return (
    <nav className={styles.nav} aria-label={copy.principle.navLabel}>
      <span className={`mono ${styles.navTitle}`}>{copy.principle.navLabel}</span>
      <ol className={styles.list}>
        {chapters.map((chapter, index) => {
          const active = chapter.id === activeId
          return (
            <li key={chapter.id}>
              <button
                type="button"
                className={[styles.item, active && styles.active].filter(Boolean).join(' ')}
                aria-current={active ? 'true' : undefined}
                onClick={() => onJump(chapter.id)}
              >
                <span className={`mono ${styles.index}`}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.itemTitle}>{chapter.title}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
