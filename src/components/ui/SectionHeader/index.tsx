import type { ReactNode } from 'react'

import styles from './SectionHeader.module.css'

export interface SectionHeaderProps {
  /** 展区编号，如「HALL 01」 */
  index: string
  title: ReactNode
  caption?: ReactNode
  /** 右上角插槽，通常放「为什么会这样？」链接 */
  action?: ReactNode
  titleId?: string
  className?: string
}

export function SectionHeader({
  index,
  title,
  caption,
  action,
  titleId,
  className,
}: SectionHeaderProps) {
  const classes = [styles.header, className].filter(Boolean).join(' ')
  return (
    <header className={classes}>
      <div className={styles.main}>
        <span className="hall-index">{index}</span>
        <h2 id={titleId} className={`display ${styles.title}`}>
          {title}
        </h2>
        {caption && <p className={`caption ${styles.caption}`}>{caption}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  )
}
