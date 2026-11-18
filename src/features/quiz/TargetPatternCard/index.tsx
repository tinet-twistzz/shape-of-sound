import { SandCanvas } from '@/components/sand/SandCanvas'
import { SoundExhibitIcon } from '@/components/ui/icons'
import { copy } from '@/content/copy'
import type { PatternParams, SoundPreset } from '@/types/domain'

import styles from './TargetPatternCard.module.css'

export interface TargetPatternCardProps {
  pattern: PatternParams
  patternName: string
  /** 展品编号，如「PLATE № 01」 */
  code: string
  /** 答对后揭示作者（声音展品），铭牌随之更新 */
  revealedSound?: SoundPreset | null
}

/** 画框中的目标图案：金色框缘 + 深色卡纸 + 聚光灯 + 画作名牌 */
export function TargetPatternCard({
  pattern,
  patternName,
  code,
  revealedSound,
}: TargetPatternCardProps) {
  return (
    <figure className={styles.frame}>
      <div className={styles.edge}>
        <div className={styles.mat}>
          <div className={styles.thumb}>
            <SandCanvas
              key={`${pattern.n}-${pattern.m}`}
              pattern={pattern}
              theme="gold"
              energy={0.6}
            />
          </div>
        </div>
      </div>
      <figcaption className={styles.plaque}>
        <span className={`mono ${styles.plaqueCode}`}>
          {code} · {revealedSound ? copy.sections.quiz.identified : copy.sections.quiz.unidentified}
        </span>
        <span className={`display ${styles.plaqueName}`}>{patternName}</span>
        <span className={`caption ${styles.plaqueNote}`}>
          {revealedSound ? (
            <span className={styles.plaqueReveal}>
              <SoundExhibitIcon
                id={revealedSound.id}
                size={14}
                className={styles.plaqueIcon}
              />
              {revealedSound.name} · {revealedSound.frequencyHz} Hz
            </span>
          ) : (
            copy.sections.quiz.anonymousWork
          )}
        </span>
      </figcaption>
    </figure>
  )
}
