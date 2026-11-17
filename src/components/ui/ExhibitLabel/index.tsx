import type { ReactNode } from 'react'

import styles from './ExhibitLabel.module.css'

export interface ExhibitLabelRow {
  label: string
  value: ReactNode
}

export interface ExhibitLabelProps {
  title: ReactNode
  /** 展品编号，如「PLATE № 04」 */
  code?: string
  rows?: readonly ExhibitLabelRow[]
  note?: ReactNode
  className?: string
}

/** 展签：美术馆墙面上的展品说明牌 */
export function ExhibitLabel({ title, code, rows, note, className }: ExhibitLabelProps) {
  const classes = [styles.label, className].filter(Boolean).join(' ')
  return (
    <article className={classes}>
      {code && <span className={`mono ${styles.code}`}>{code}</span>}
      <h3 className={`display ${styles.title}`}>{title}</h3>
      {rows && rows.length > 0 && (
        <dl className={styles.rows}>
          {rows.map((row) => (
            <div key={row.label} className={styles.row}>
              <dt className={styles.rowLabel}>{row.label}</dt>
              <dd className={`mono ${styles.rowValue}`}>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <p className={`caption ${styles.note}`}>{note}</p>}
    </article>
  )
}
