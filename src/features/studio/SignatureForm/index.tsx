import { useId } from 'react'

import { Button } from '@/components/ui/Button'
import { ArrowRightIcon, CameraIcon, SparkIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'

import styles from './SignatureForm.module.css'

export type SignatureBusy = 'download' | 'publish' | null

export interface SignatureFormProps {
  author: string
  onAuthorChange: (author: string) => void
  onDownload: () => void
  onPublish: () => void
  onViewExhibition?: () => void
  busy: SignatureBusy
  className?: string
}

const MAX_AUTHOR_LENGTH = 12
const t = copy.sections.studio

/** 署名 + 下载典藏卡 / 发布到展厅 */
export function SignatureForm({
  author,
  onAuthorChange,
  onDownload,
  onPublish,
  onViewExhibition,
  busy,
  className,
}: SignatureFormProps) {
  const id = useId()
  const classes = [styles.form, className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className={styles.head}>
        <label className={styles.label} htmlFor={id}>
          {t.authorLabel}
        </label>
        <span className={`mono ${styles.counter}`} aria-hidden="true">
          {author.length}/{MAX_AUTHOR_LENGTH}
        </span>
      </div>
      <input
        id={id}
        type="text"
        className={styles.input}
        value={author}
        maxLength={MAX_AUTHOR_LENGTH}
        placeholder={t.authorPlaceholder}
        autoComplete="off"
        onChange={(event) => onAuthorChange(event.target.value.slice(0, MAX_AUTHOR_LENGTH))}
      />
      <div className={styles.row}>
        <Button
          variant="outline"
          disabled={busy !== null}
          className={styles.submit}
          onClick={onDownload}
        >
          <CameraIcon size={15} />
          {busy === 'download' ? t.downloading : t.downloadLabel}
        </Button>
        <Button
          variant="primary"
          disabled={busy !== null}
          className={styles.submit}
          onClick={onPublish}
        >
          <SparkIcon size={15} />
          {busy === 'publish' ? t.publishing : t.publishLabel}
        </Button>
      </div>
      <div className={styles.footerRow}>
        <p className={styles.note}>{t.signatureNote}</p>
        {onViewExhibition && (
          <button type="button" className={styles.exhibitionLink} onClick={onViewExhibition}>
            <span>{t.viewInExhibitionLabel}</span>
            <ArrowRightIcon size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
