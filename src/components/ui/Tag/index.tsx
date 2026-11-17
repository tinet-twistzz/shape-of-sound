import type { ReactNode } from 'react'

import styles from './Tag.module.css'

export type TagTone = 'gold' | 'cyan' | 'violet' | 'success' | 'warning' | 'danger' | 'neutral'

export interface TagProps {
  tone?: TagTone
  className?: string
  children: ReactNode
}

export function Tag({ tone = 'neutral', className, children }: TagProps) {
  const classes = [styles.tag, styles[tone], className].filter(Boolean).join(' ')
  return <span className={classes}>{children}</span>
}
