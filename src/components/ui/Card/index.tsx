import type { ReactNode } from 'react'

import styles from './Card.module.css'

export interface CardProps {
  /** 选中态：金色描边 + 光晕 */
  selected?: boolean
  /** 传入后卡片成为可点击按钮（原生键盘可访问，aria-pressed 表达选中） */
  onSelect?: () => void
  className?: string
  children: ReactNode
}

export function Card({ selected = false, onSelect, className, children }: CardProps) {
  const classes = [
    styles.card,
    onSelect && styles.interactive,
    selected && styles.selected,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (onSelect) {
    return (
      <button type="button" className={classes} aria-pressed={selected} onClick={onSelect}>
        {children}
      </button>
    )
  }
  return <div className={classes}>{children}</div>
}
