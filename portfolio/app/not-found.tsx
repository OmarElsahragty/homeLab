'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import styles from './not-found.module.scss';

export default function NotFound() {
  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.inner}>
        <h1 className={styles.code}>404</h1>
        <h2 className={styles.title}>Page Not Found</h2>
        <p className={styles.description}>
          <span className={styles.prompt}>$</span> curl -s https://sahragty.me{'{path}'}
          <br />
          <span className={styles.error}>Error:</span> Route not found in the matrix.
        </p>
        <Link href="/" className={styles.homeLink}>
          cd ~/home
        </Link>
      </div>
    </motion.div>
  );
}
