import { useEffect, useId, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { CloseIcon, SparkIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'

import styles from './PublishDialog.module.css'

const t = copy.sections.studio
const MAX_TITLE_LENGTH = 24

export interface PublishDialogProps {
  defaultTitle: string
  busy: boolean
  onCancel: () => void
  onConfirm: (title: string) => void
}

/** 发布到公共展厅：确认作品标题 */
export function PublishDialog({ defaultTitle, busy, onCancel, onConfirm }: PublishDialogProps) {
  const id = useId()
  const [title, setTitle] = useState(defaultTitle)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  const trimmed = title.trim()

  return (
    <div className={styles.overlay} role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t.publishDialogTitle}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.head}>
          <h3 className={`display ${styles.title}`}>{t.publishDialogTitle}</h3>
          <IconButton label={copy.buttons.cancel} variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            <CloseIcon size={16} />
          </IconButton>
        </header>

        <label className={styles.label} htmlFor={id}>
          {t.publishTitleLabel}
        </label>
        <input
          id={id}
          type="text"
          className={styles.input}
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder={t.publishTitlePlaceholder}
          autoComplete="off"
          autoFocus
          onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
        />
        <p className={styles.note}>{t.publishNote}</p>

        <footer className={styles.actions}>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            {copy.buttons.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !trimmed}
            onClick={() => onConfirm(trimmed)}
          >
            <SparkIcon size={15} />
            {busy ? t.publishing : t.publishConfirm}
          </Button>
        </footer>
      </div>
    </div>
  )
}