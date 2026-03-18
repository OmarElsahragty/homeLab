'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button/Button';
import TypingText from '@/components/ui/TypingText/TypingText';
import { staggerContainer, staggerChild } from '@/constants/animations';
import { useLang } from '@/contexts/LangContext';
import styles from './Hero.module.scss';

/**
 * Isolated text content component.
 * Keyed by `lang` to force remount on language change — ensures TypingText animation state
 * resets and prevents both languages from appearing simultaneously.
 */
function HeroContent() {
  const { t } = useLang();

  return (
    <motion.div
      className={styles.textCol}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerChild}>
        <h1 className={styles.headline}>
          <TypingText text={t.hero.greeting} speed={60} />
        </h1>
      </motion.div>

      <motion.p variants={staggerChild} className={styles.subtext}>
        {t.hero.tagline}
      </motion.p>

      <motion.p variants={staggerChild} className={styles.role}>
        {t.hero.role} @ <span className={styles.accentYellow}>{t.hero.company}</span> |{' '}
        {t.hero.from} <span className={styles.accentWhite}>{t.hero.location}</span>
      </motion.p>

      <motion.div variants={staggerChild} className={styles.status}>
        <span className={styles.statusDot}>
          <span className={styles.statusPing} />
          <span className={styles.statusSolid} />
        </span>
        <span className={styles.statusText}>{t.hero.available}</span>
      </motion.div>

      <motion.div variants={staggerChild} className={styles.cta}>
        <Button
          href="#contact"
          variant="green"
          size="lg"
          onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}
        >
          {t.hero.ctaHire}
        </Button>
        <Button
          variant="blue"
          size="lg"
          onClick={() => document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth' })}
        >
          {t.hero.ctaDocs}
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default function Hero() {
  const [quacking, setQuacking] = useState(false);
  const [quackCount, setQuackCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { lang } = useLang();

  const handleQuack = useCallback(() => {
    if (quacking) return;
    setQuacking(true);
    setQuackCount((c) => c + 1);

    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/Quack.mp3');
    }
    audioRef.current.currentTime = 0;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    audioRef.current.play().catch(() => {});

    setTimeout(() => setQuacking(false), 600);
  }, [quacking]);

  const { t } = useLang();

  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.bg} />
      <div className={styles.grid} />

      <div className={styles.content}>
        <div className={styles.columns}>
          {/* key={lang} on HeroContent forces remount when language changes, resetting all stateful components like TypingText */}
          <HeroContent key={lang} />

          {/* Profile picture column */}
          <motion.div
            className={styles.profileCol}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.profileWrapper}>
              <div className={styles.profileGlow} />
              <div className={styles.profileImageContainer}>
                <Image
                  src="/images/profile/Profile.jpg"
                  alt="Omar Elsahragty"
                  width={400}
                  height={400}
                  className={styles.profileImage}
                  priority
                />
              </div>
              <div className={styles.profileRing} />
              <button
                key={quackCount}
                type="button"
                className={`${styles.duckBadge} ${quacking ? styles.duckQuack : ''}`}
                onClick={handleQuack}
                aria-label="Quack!"
              >
                🦆
              </button>
            </div>
            <p className={styles.duckCaption}>{t.hero.duckCaption}</p>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className={styles.scrollIndicator}
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className={styles.scrollPill}>
          <motion.div
            className={styles.scrollDot}
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}
