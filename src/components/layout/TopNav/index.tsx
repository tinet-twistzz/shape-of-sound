import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { BookIcon, CloseIcon, MenuIcon, SpeakerIcon, SpeakerMutedIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import { useScrollTo } from '@/hooks/useScrollTo'
import { useAppActions, useAppState } from '@/store/appStateContext'
import type { SectionId } from '@/types/domain'

import styles from './TopNav.module.css'

const NAV_LINKS: readonly SectionId[] = ['gallery', 'quiz', 'studio', 'exhibition']

export function TopNav() {
  const { currentSection, muted } = useAppState()
  const actions = useAppActions()
  const scrollTo = useScrollTo()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 菜单展开时把前进 Tab 圈在菜单内，避免焦点落到遮罩后的页面内容
  const handleMenuTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || event.shiftKey) return
    const menu = menuRef.current
    if (!menu) return
    const items = menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    if (items.length === 0) return
    if (document.activeElement === items[items.length - 1]) {
      event.preventDefault()
      items[0].focus()
    }
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const navigate = (id: SectionId) => {
    setMenuOpen(false)
    scrollTo(id)
  }

  const openPrinciple = () => {
    setMenuOpen(false)
    actions.openPrinciple()
  }

  const muteLabel = muted ? copy.nav.muteOff : copy.nav.muteOn

  return (
    <nav className={styles.nav} aria-label={copy.nav.ariaLabel}>
      <div className={styles.inner}>
        <button type="button" className={styles.brand} onClick={() => navigate('hero')}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={styles.brandName}>{copy.nav.brand}</span>
          <span className={`mono ${styles.brandEn}`}>{copy.nav.brandEn}</span>
        </button>

        <div className={styles.links}>
          {NAV_LINKS.map((id) => (
            <button
              key={id}
              type="button"
              className={[styles.link, currentSection === id && styles.active]
                .filter(Boolean)
                .join(' ')}
              aria-current={currentSection === id ? 'true' : undefined}
              onClick={() => navigate(id)}
            >
              {copy.nav.items[id]}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            className={styles.principleButton}
            onClick={openPrinciple}
          >
            <BookIcon size={14} />
            {copy.nav.principle}
          </Button>
          <IconButton
            label={muteLabel}
            variant={muted ? 'outline' : 'ghost'}
            size="sm"
            aria-pressed={muted}
            onClick={actions.toggleMute}
          >
            {muted ? <SpeakerMutedIcon size={16} /> : <SpeakerIcon size={16} />}
          </IconButton>
          <IconButton
            label={menuOpen ? copy.nav.menuCollapse : copy.nav.menuExpand}
            size="sm"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseIcon size={16} /> : <MenuIcon size={16} />}
          </IconButton>
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            className={styles.menuOverlay}
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
          <div id="mobile-menu" className={styles.menu} ref={menuRef} onKeyDown={handleMenuTab}>
            {NAV_LINKS.map((id) => (
              <button
                key={id}
                type="button"
                className={[styles.menuLink, currentSection === id && styles.active]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={currentSection === id ? 'true' : undefined}
                onClick={() => navigate(id)}
              >
                <span className={`mono ${styles.menuIndex}`}>
                  {copy.nav.menuHallIndex(NAV_LINKS.indexOf(id) + 1)}
                </span>
                {copy.nav.items[id]}
              </button>
            ))}
            <Button variant="outline" size="md" onClick={openPrinciple}>
              <BookIcon size={15} />
              {copy.nav.principle}
            </Button>
          </div>
        </>
      )}
    </nav>
  )
}
