'use client';

import type { ErrorPageProps } from '@/types/next';
import styles from './global-error.module.scss';

export default function GlobalError({ error, reset }: ErrorPageProps) {
  return (
    <html lang="en">
      <body className={styles.globalError}>
        <div>
          <h1 className={styles.title}>Critical Application Error</h1>
          <p className={styles.message}>
            We&apos;re sorry. The application encountered a critical issue. Please try reloading.
          </p>
          <button onClick={() => reset()} className={styles.button}>
            Reload Application
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details className={styles.details}>
              <summary className={styles.summary}>Error Details (Development Only)</summary>
              <pre className={styles.pre}>{error.message}</pre>
            </details>
          )}
        </div>
      </body>
    </html>
  );
}
