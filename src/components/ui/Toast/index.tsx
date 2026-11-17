import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon } from '@/components/ui/icons'
import { ToastContext } from '@/components/ui/Toast/toastContext'
import type { ToastFn, ToastTone } from '@/components/ui/Toast/toastContext'
import { copy } from '@/content/copy'

import styles from './Toast.module.css'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  leaving: boolean
}

const AUTO_DISMISS_MS = 3400
const EXIT_MS = 240
const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)
  const autoTimers = useRef(new Map<number, number>())
  const exitTimers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    const auto = autoTimers.current.get(id)
    if (auto !== undefined) {
      window.clearTimeout(auto)
      autoTimers.current.delete(id)
    }
    if (exitTimers.current.has(id)) return
    setItems((list) => list.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
    const exit = window.setTimeout(() => {
      exitTimers.current.delete(id)
      setItems((list) => list.filter((item) => item.id !== id))
    }, EXIT_MS)
    exitTimers.current.set(id, exit)
  }, [])

  const toast = useCallback<ToastFn>(
    (message, tone = 'info') => {
      counter.current += 1
      const id = counter.current
      setItems((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, message, tone, leaving: false }])
      const timer = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      autoTimers.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const auto = autoTimers.current
    const exit = exitTimers.current
    return () => {
      auto.forEach((timer) => window.clearTimeout(timer))
      exit.forEach((timer) => window.clearTimeout(timer))
      auto.clear()
      exit.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className={styles.viewport} role="status" aria-live="polite">
          {items.map((item) => (
            <div
              key={item.id}
              className={[styles.toast, styles[item.tone], item.leaving && styles.leaving]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.message}>{item.message}</span>
              <button
                type="button"
                className={styles.close}
                aria-label={copy.aria.closeToast}
                onClick={() => dismiss(item.id)}
              >
                <CloseIcon size={13} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
