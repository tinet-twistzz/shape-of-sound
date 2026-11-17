import { useId, useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { CameraIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'

import styles from './SignatureForm.module.css'

export interface SignatureFormProps {
  author: string
  onAuthorChange: (author: string) => void
  /** 组装画作并导出，由外层完成 snapshot + export + Toast */
  onSubmit: () => Promise<void>
  className?: string
}

const MAX_AUTHOR_LENGTH = 12

/** 署名 + 落款收藏 */
export function SignatureForm({ author, onAuthorChange, onSubmit, className }: SignatureFormProps) {
  const id = useId()
  const [submitting, setSubmitting] = useState(false)
  const classes = [styles.form, className].filter(Boolean).join(' ')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await onSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className={classes} onSubmit={handleSubmit}>
      <div className={styles.head}>
        <label className={styles.label} htmlFor={id}>
          {copy.sections.studio.authorLabel}
        </label>
        <span className={`mono ${styles.counter}`} aria-hidden="true">
          {author.length}/{MAX_AUTHOR_LENGTH}
        </span>
      </div>
      <div className={styles.row}>
        <input
          id={id}
          type="text"
          className={styles.input}
          value={author}
          maxLength={MAX_AUTHOR_LENGTH}
          placeholder={copy.sections.studio.authorPlaceholder}
          autoComplete="off"
          onChange={(event) => onAuthorChange(event.target.value.slice(0, MAX_AUTHOR_LENGTH))}
        />
        <Button type="submit" variant="primary" disabled={submitting} className={styles.submit}>
          <CameraIcon size={15} />
          {submitting ? copy.sections.studio.exporting : copy.sections.studio.exportLabel}
        </Button>
      </div>
      <p className={styles.note}>{copy.sections.studio.signatureNote}</p>
    </form>
  )
}
