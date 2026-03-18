'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader/SectionHeader';
import ScrollReveal from '@/components/ui/ScrollReveal/ScrollReveal';
import { experiences } from '@/constants/data';
import { getThemeClass } from '@/utils/styleUtils';
import { useLang } from '@/contexts/LangContext';
import styles from './Experience.module.scss';

/**
 * Isolated experience items display.
 * Keyed by lang to ensure expand state resets on language change,
 * preventing stale UI state when toggling between languages.
 */
function ExperienceContent() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { t } = useLang();

  const toggleExpand = (hash: string) => setExpanded((prev) => (prev === hash ? null : hash));

  return (
    <div className={styles.terminalWrap} data-terminal-surface>
      <div className={styles.terminalHeader}>
        <div className={`${styles.dot} ${styles.red}`} />
        <div className={`${styles.dot} ${styles.yellow}`} />
        <div className={`${styles.dot} ${styles.green}`} />
        <span className={styles.terminalTitle}>git log</span>
      </div>

      <div className={styles.commits}>
        {experiences.map((exp, index) => {
          const tExp = t.experienceItems[index];
          return (
            <ScrollReveal key={exp.hash} delay={index * 0.1}>
              <div
                className={`${styles.entry} ${getThemeClass(exp.color)} ${exp.isCurrent ? styles.isCurrent : ''}`}
              >
                {index < experiences.length - 1 && <div className={styles.line} />}

                <div className={styles.commitDot}>
                  {exp.isCurrent && <span className={styles.commitDotPulse} />}
                </div>

                <button
                  onClick={() => tExp.details.length > 0 && toggleExpand(exp.hash)}
                  className={styles.commitBtn}
                  aria-label={`Expand ${tExp.role} at ${exp.company}`}
                  aria-expanded={expanded === exp.hash}
                  disabled={tExp.details.length === 0}
                >
                  <div className={styles.commitMeta}>
                    <span className={styles.commitHash}>{exp.hash}</span>
                    <span className={styles.commitDate}>{exp.date}</span>
                    {exp.isCurrent && (
                      <span className={styles.headBadge}>{t.experience.headBadge}</span>
                    )}
                  </div>

                  <h3 className={styles.commitRole}>
                    {tExp.role} <span className={styles.commitCompany}>@ {exp.company}</span>
                  </h3>

                  <p className={styles.commitInfo}>
                    {tExp.type} · {tExp.duration}
                  </p>
                </button>

                <AnimatePresence>
                  {expanded === exp.hash && (
                    <motion.div
                      className={styles.details}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className={styles.detailsInner}>
                        {tExp.details.map((detail, i) => (
                          <motion.p
                            key={i}
                            className={styles.detail}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                          >
                            <span className={styles.detailArrow}>→</span> {detail}
                          </motion.p>
                        ))}

                        <div className={styles.techPills}>
                          {exp.tech.map((tech) => (
                            <span key={tech} className={styles.techPill}>
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  );
}

export default function Experience() {
  const { lang, t } = useLang();

  return (
    <section id="experience" className={styles.experience}>
      <div className={styles.bg} />

      <div className={styles.inner}>
        <SectionHeader title={t.experience.title} subtitle={t.experience.subtitle} />

        {/* key={lang} ensures expand state resets on language change */}
        <ExperienceContent key={lang} />
      </div>
    </section>
  );
}
