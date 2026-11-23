import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon } from '@/components/ui/icons'
import { IconButton } from '@/components/ui/IconButton'
import { copy } from '@/content/copy'
import { useModalLayer } from '@/hooks/useModalLayer'

import styles from './Drawer.module.css'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  footer?: ReactNode
  className?: string
  children: ReactNode
}

const EXIT_MS = 260

/** 右侧滑出抽屉：ESC / 遮罩关闭，锁定页面滚动，焦点圈定在面板内并在关闭后归还 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  className,
  children,
}: DrawerProps) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const { handleKeyDown } = useModalLayer(panelRef, { open, onClose })

  useEffect(() => {
    if (open) {
      setMounted(true)
      let rafInner = 0
      const rafOuter = requestAnimationFrame(() => {
        rafInner = requestAnimationFrame(() => setShown(true))
      })
      return () => {
        cancelAnimationFrame(rafOuter)
        cancelAnimationFrame(rafInner)
      }
    }
    setShown(false)
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open && !mounted) return null

  const classes = [styles.root, shown && styles.shown].filter(Boolean).join(' ')
  const panelClasses = [styles.panel, className].filter(Boolean).join(' ')

  return createPortal(
    <div className={classes}>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={panelClasses}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            {subtitle && <span className={`mono ${styles.subtitle}`}>{subtitle}</span>}
            <h2 id={titleId} className={`display ${styles.title}`}>
              {title}
            </h2>
          </div>
          <IconButton label={copy.aria.closeDrawer} size="sm" onClick={onClose}>
            <CloseIcon size={16} />
          </IconButton>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </aside>
    </div>,
    document.body,
  )
}
