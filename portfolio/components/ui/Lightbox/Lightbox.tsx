'use client';

import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import type { LightboxProps } from '@/types/components';
import styles from './Lightbox.module.scss';

export default function Lightbox({
  images,
  current,
  alt = 'Image',
  onClose,
  onNavigate,
}: LightboxProps) {
  const prev = useCallback(
    () => onNavigate(current === 0 ? images.length - 1 : current - 1),
    [current, images.length, onNavigate]
  );
  const next = useCallback(
    () => onNavigate(current === images.length - 1 ? 0 : current + 1),
    [current, images.length, onNavigate]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
    >
      {/* Counter */}
      {images.length > 1 && (
        <div className={styles.counter}>
          {current + 1} / {images.length}
        </div>
      )}

      {/* Close button */}
      <button className={styles.close} onClick={onClose} aria-label="Close lightbox">
        <FaTimes size={16} />
      </button>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button
            className={`${styles.nav} ${styles.navLeft}`}
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous image"
          >
            <FaChevronLeft size={18} />
          </button>
          <button
            className={`${styles.nav} ${styles.navRight}`}
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next image"
          >
            <FaChevronRight size={18} />
          </button>
        </>
      )}

      {/* Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          className={styles.imageWrap}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={images[current]}
            alt={`${alt} ${current + 1}`}
            fill
            sizes="100vw"
            className={styles.image}
            priority
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
