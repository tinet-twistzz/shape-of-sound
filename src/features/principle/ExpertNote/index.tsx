import { useId, useState } from 'react'

import { copy } from '@/content/copy'

import styles from './ExpertNote.module.css'

export interface ExpertNoteProps {
  note: string
}

/** 「学霸模式」折叠区：术语与公式只出现在这里，默认收起 */
export function ExpertNote({ note }: ExpertNoteProps) {
  const [open, setOpen] = useState(false)
  const regionId = useId()

  return (
    <div className={[styles.root, open && styles.open].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.caret} aria-hidden="true">
          ▸
        </span>
        <span className={styles.label}>{copy.principle.expertModeLabel}</span>
        <span className={`mono ${styles.hint}`}>{copy.principle.expertModeHint}</span>
      </button>
      <div id={regionId} className={styles.collapse} aria-hidden={!open}>
        <div className={styles.collapseInner}>
          <p className={styles.note}>{note}</p>
        </div>
      </div>
    </div>
  )
}
