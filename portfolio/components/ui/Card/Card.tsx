'use client';

import type { CardProps } from '@/types/components';
import styles from './Card.module.scss';

export default function Card({ children, className, glowColor }: CardProps) {
  return (
    <div
      className={`${styles.card} ${className ?? ''}`}
      style={glowColor ? ({ '--glow-color': glowColor } as React.CSSProperties) : undefined}
    >
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
