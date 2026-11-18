import { CloseIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import type { ParticleTheme } from '@/types/domain'

import styles from './ArtworkCard.module.css'

const THEME_DOT: Record<ParticleTheme, string> = {
  gold: '#f3c969',
  glacier: '#56cfe1',
  neon: '#9d4edd',
  voice: 'linear-gradient(135deg, #f3c969, #56cfe1, #9d4edd)',
}

export interface ArtworkCardProps {
  title: string
  author: string
  theme: ParticleTheme
  imageUrl: string
  order: number
  onOpen: () => void
  onRemove?: () => void
}

const t = copy.sections.exhibition

/** 深色卡纸 + 暖金细框的静帧画框；列表不跑实时动画 */
export function ArtworkCard({ title, author, theme, imageUrl, order, onOpen, onRemove }: ArtworkCardProps) {
  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.frame}
        aria-label={t.cardAria(title, author)}
        onClick={onOpen}
      >
        <span className={styles.mat}>
          <img className={styles.image} src={imageUrl} alt="" loading="lazy" draggable={false} />
        </span>
        <span className={styles.label}>
          <span className={`mono ${styles.code}`}>{t.exhibitCode(order)}</span>
          <span className={`display ${styles.title}`}>《{title}》</span>
          <span className={styles.meta}>
            <span className={styles.author}>{author}</span>
            <span className={`mono ${styles.themeTag}`}>
              <span
                className={styles.themeDot}
                style={{ background: THEME_DOT[theme] }}
                aria-hidden="true"
              />
              {copy.sections.studio.themes[theme]}
            </span>
          </span>
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`${t.removeLabel}：《${title}》`}
          title={t.removeLabel}
          onClick={onRemove}
        >
          <CloseIcon size={13} />
        </button>
      )}
    </div>
  )
}