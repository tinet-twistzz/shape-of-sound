import { useCallback, useEffect } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

export interface UseModalLayerOptions {
  open: boolean
  onClose: () => void
  /** 是否允许通过 ESC 关闭（提交中等忙碌态可传 false），默认 true */
  closable?: boolean
  /** 打开后优先聚焦的元素；未传则聚焦容器本身 */
  initialFocusRef?: RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * 统一弹层行为：锁定 body 滚动并补偿滚动条宽度、打开自动聚焦、正反向 Tab 焦点圈定、ESC 关闭、卸载归还焦点。
 */
export function useModalLayer(
  panelRef: RefObject<HTMLElement | null>,
  { open, onClose, closable = true, initialFocusRef }: UseModalLayerOptions,
) {
  useEffect(() => {
    if (!open) return
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
  }, [open])

  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const raf = requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? panelRef.current
      target?.focus()
    })
    return () => {
      cancelAnimationFrame(raf)
      trigger?.focus()
    }
  }, [open, panelRef, initialFocusRef])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') {
        if (!closable) return
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    },
    [closable, onClose, panelRef],
  )

  return { handleKeyDown }
}
