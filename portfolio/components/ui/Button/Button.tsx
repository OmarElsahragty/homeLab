'use client';

import type { ButtonProps } from '@/types/components';
import styles from './Button.module.scss';

export default function Button({
  children,
  href,
  onClick,
  variant = 'blue',
  size = 'md',
  className,
  ariaLabel,
}: ButtonProps) {
  const cls = `${styles.button} ${styles[variant]} ${styles[size]} ${className ?? ''}`;

  if (href) {
    return (
      <a
        href={href}
        className={cls}
        aria-label={ariaLabel}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={cls} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
