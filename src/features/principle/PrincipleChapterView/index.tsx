import { Button } from '@/components/ui/Button'
import { ArrowRightIcon, SparkIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import { ExpertNote } from '@/features/principle/ExpertNote'
import { getIllustrationMeta } from '@/features/principle/illustrationMeta'
import type { PrincipleChapter, SectionId } from '@/types/domain'

import styles from './PrincipleChapterView.module.css'

export interface PrincipleChapterViewProps {
  chapter: PrincipleChapter
  index: number
  onGoToSection: (section: SectionId) => void
}

/** 单章内容：编号 + 标题 + 一句话摘要 + 正文 + 插图占位 + 学霸模式 + 展区入口 */
export function PrincipleChapterView({ chapter, index, onGoToSection }: PrincipleChapterViewProps) {
  const illustration = getIllustrationMeta(chapter.illustrationKey)
  const relatedSection = chapter.relatedSection

  return (
    <article id={`principle-${chapter.id}`} className={styles.chapter}>
      <header className={styles.header}>
        <span className="hall-index">{copy.principle.chapterCode(index + 1)}</span>
        <h3 className={`display ${styles.title}`}>{chapter.title}</h3>
      </header>

      <p className={styles.summary}>{chapter.summary}</p>

      <figure
        className={[styles.illustration, styles[illustration.tone]].filter(Boolean).join(' ')}
        aria-label={copy.principle.illustrationAria(illustration.label)}
      >
        <span className={styles.grain} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <SparkIcon size={20} className={styles.illustrationIcon} />
        <figcaption className={styles.illustrationLabel}>
          {copy.principle.illustrationPrefix}
          {illustration.label}
        </figcaption>
        <span className={`mono ${styles.illustrationCode}`}>
          {copy.principle.illustrationPending} · {chapter.illustrationKey}
        </span>
      </figure>

      <div className={styles.body}>
        {chapter.body.map((paragraph) => (
          <p key={paragraph.slice(0, 12)} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}
      </div>

      {chapter.expertNote && <ExpertNote note={chapter.expertNote} />}

      {relatedSection && (
        <Button
          variant="outline"
          size="sm"
          className={styles.goButton}
          onClick={() => onGoToSection(relatedSection)}
        >
          {copy.principle.relatedSectionLabel}
          <ArrowRightIcon size={13} />
        </Button>
      )}
    </article>
  )
}
