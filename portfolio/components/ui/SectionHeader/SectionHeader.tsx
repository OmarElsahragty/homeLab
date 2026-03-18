'use client';

import { motion } from 'framer-motion';
import type { SectionHeaderProps } from '@/types/components';
import styles from './SectionHeader.module.scss';

export default function SectionHeader({
  title,
  subtitle,
  className,
  align = 'center',
}: SectionHeaderProps) {
  return (
    <motion.div
      className={`${styles.header} ${styles[align]} ${className ?? ''}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6 }}
    >
      <h2 className={styles.title}>
        <span className={styles.titleText}>{title}</span>
        <span className={styles.cursor}>_</span>
      </h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      <motion.div
        className={styles.underline}
        initial={{ width: 0 }}
        whileInView={{ width: 120 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />
    </motion.div>
  );
}
