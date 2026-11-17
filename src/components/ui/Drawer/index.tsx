import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon } from '@/components/ui/icons'
import { IconButton } from '@/components/ui/IconButton'
import { copy } from '@/content/copy'

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

  // 锁定滚动（补偿滚动条宽度，避免页面跳动）
  useEffect(() => {
    if (!mounted) return
    const { body, documentElement } = document
    const prevOverflow = body.style.overflow
    const prevPadding = body.style.paddingRight
    const scrollbar = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPadding
    }
  }, [mounted])

  // 关闭后把焦点还给触发元素
  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => trigger?.focus()
  }, [open])

  useEffect(() => {
    if (shown) panelRef.current?.focus()
  }, [shown])

  if (!mounted) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusables = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )
    if (focusables.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

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
