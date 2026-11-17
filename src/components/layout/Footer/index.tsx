import { copy } from '@/content/copy'

import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className="hall-index">{copy.footer.hallEnd}</span>
        <p className={`display ${styles.brandLine}`}>{copy.footer.brandLine}</p>
        <p className={`caption ${styles.note}`}>
          {copy.footer.simulationNote}
          {copy.footer.note}
        </p>
        <p className={`caption ${styles.audioCredit}`}>{copy.footer.audioCredit}</p>
        <p className={`mono ${styles.credit}`}>{copy.footer.credit}</p>
      </div>
    </footer>
  )
}
