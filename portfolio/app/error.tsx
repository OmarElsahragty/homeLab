'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { ErrorPageProps } from '@/types/next';
import styles from './error.module.scss';

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[Error Boundary]', error);
  }, [error]);

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Something went wrong</h2>
      <p className={styles.description}>
        An unexpected error occurred. Please try again, or go back to the home page.
      </p>
      <div className={styles.actions}>
        <button onClick={() => reset()} className={styles.btnPrimary}>
          Try Again
        </button>
        <Link href="/" className={styles.btnSecondary}>
          Go Home
        </Link>
      </div>
    </div>
  );
}
