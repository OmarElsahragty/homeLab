'use client';

import type { TerminalProps } from '@/types/components';
import styles from './Terminal.module.scss';

export default function Terminal({ title = 'bash', children, className }: TerminalProps) {
  return (
    <div className={`${styles.terminal} ${className ?? ''}`} data-terminal-surface>
      <div className={styles.titleBar}>
        <span className={`${styles.dot} ${styles.dotRed}`} />
        <span className={`${styles.dot} ${styles.dotYellow}`} />
        <span className={`${styles.dot} ${styles.dotGreen}`} />
        <span className={styles.titleText}>{title}</span>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
