import { useEffect, useState } from 'react'

import type { SectionId } from '@/types/domain'

/** 根据滚动位置返回当前展区；ids 需为稳定引用（模块级常量） */
export function useScrollSpy(ids: readonly SectionId[]): SectionId {
  const [active, setActive] = useState<SectionId>(ids[0])

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const probe = window.scrollY + window.innerHeight * 0.35
      let current = ids[0]
      for (const id of ids) {
        const element = document.getElementById(id)
        if (element && element.offsetTop <= probe) current = id
      }
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) current = ids[ids.length - 1]
      setActive((prev) => (prev === current ? prev : current))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ids])

  return active
}
