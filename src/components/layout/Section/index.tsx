import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import type { SectionId } from '@/types/domain'

import styles from './Section.module.css'

export interface SectionProps {
  id: SectionId
  /** 内容在视口内垂直居中（用于序厅与占位展区） */
  center?: boolean
  className?: string
  children: ReactNode
}

/** 展区容器：全屏最小高度，进入视口时淡入 */
export function Section({ id, center = false, className, children }: SectionProps) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const classes = [styles.section, center && styles.center, visible && styles.visible, className]
    .filter(Boolean)
    .join(' ')

  return (
    <section ref={ref} id={id} className={classes}>
      <div className={styles.inner}>{children}</div>
    </section>
  )
}
