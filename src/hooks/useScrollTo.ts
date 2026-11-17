import { useCallback } from 'react'

import { useReducedMotion } from '@/hooks/useReducedMotion'

/** 平滑滚动到指定展区；偏移量由 CSS scroll-margin-top 处理，尊重 reduced-motion */
export function useScrollTo(): (id: string) => void {
  const reduced = useReducedMotion()
  return useCallback(
    (id: string) => {
      const element = document.getElementById(id)
      element?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    },
    [reduced],
  )
}
