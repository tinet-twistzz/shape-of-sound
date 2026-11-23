import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { CloseIcon, SparkIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import { useModalLayer } from '@/hooks/useModalLayer'

import styles from './PublishDialog.module.css'

const t = copy.sections.studio
const MAX_TITLE_LENGTH = 24

export interface PublishDialogProps {
  defaultTitle: string
  busy: boolean
  onCancel: () => void
  onConfirm: (title: string) => void
}

/** 发布到公共展厅：顶层 Portal 挂载，统一锁滚、焦点圈定、ESC 关闭与 Enter 提交 */
export function PublishDialog({ defaultTitle, busy, onCancel, onConfirm }: PublishDialogProps) {
  const inputId = useId()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(defaultTitle)

  const { handleKeyDown } = useModalLayer(dialogRef, {
    open: true,
    onClose: onCancel,
    closable: !busy,
    initialFocusRef: inputRef,
  })

  const trimmed = title.trim()

  return createPortal(
    <div className={styles.overlay} role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.head}>
          <h3 id={titleId} className={`display ${styles.title}`}>
            {t.publishDialogTitle}
          </h3>
          <IconButton
            label={copy.aria.closeDialog}
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            <CloseIcon size={16} />
          </IconButton>
        </header>

        <label className={styles.label} htmlFor={inputId}>
          {t.publishTitleLabel}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className={styles.input}
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder={t.publishTitlePlaceholder}
          autoComplete="off"
          disabled={busy}
          onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (!busy && trimmed) onConfirm(trimmed)
            }
          }}
        />
        <p className={styles.note}>{t.publishNote}</p>

        <footer className={styles.actions}>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            {copy.buttons.cancel}
          </Button>
          <Button variant="primary" disabled={busy || !trimmed} onClick={() => onConfirm(trimmed)}>
            <SparkIcon size={15} />
            {busy ? t.publishing : t.publishConfirm}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
