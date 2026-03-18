'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader/SectionHeader';
import Terminal from '@/components/ui/Terminal/Terminal';
import Card from '@/components/ui/Card/Card';
import TypingText from '@/components/ui/TypingText/TypingText';
import ScrollReveal from '@/components/ui/ScrollReveal/ScrollReveal';
import { skillCategories } from '@/constants/data';
import { staggerContainer, staggerChild } from '@/constants/animations';
import { useInView } from '@/hooks/useInView';
import { getThemeClass } from '@/utils/styleUtils';
import { useLang } from '@/contexts/LangContext';
import styles from './About.module.scss';

/** Isolated so that keying by `lang` resets both typing animation and terminalDone state. */
function TerminalBioContent({ isInView }: { isInView: boolean }) {
  const [terminalDone, setTerminalDone] = useState(false);
  const { t } = useLang();

  return (
    <div className={styles.terminalContent}>
      <div className={styles.promptLine}>
        <span className={styles.purple}>{t.about.terminalUser}</span>
        <span className={styles.dim}>@</span>
        <span className={styles.blue}>{t.about.terminalHost}</span>
        <span className={styles.dim}>:~$ </span>
        <span className={styles.text}>{t.about.whoami}</span>
      </div>

      <div className={styles.bioText}>
        {isInView ? (
          <TypingText
            text={t.about.terminalBio}
            speed={25}
            delay={500}
            showCursor
            onComplete={() => setTerminalDone(true)}
          />
        ) : null}
      </div>

      {terminalDone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={styles.npmJoke}
        >
          <div className={styles.promptLine}>
            <span className={styles.purple}>{t.about.terminalUser}</span>
            <span className={styles.dim}>@</span>
            <span className={styles.blue}>{t.about.terminalHost}</span>
            <span className={styles.dim}>:~$ </span>
            <span className={styles.text}>{t.about.npmInstall}</span>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className={styles.npmResult}
          >
            {t.about.npmResult}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className={styles.npmNote}
          >
            {t.about.npmNote}
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}

export default function About() {
  const [sectionRef, isInView] = useInView<HTMLElement>({ threshold: 0.1 });
  const { t, lang } = useLang();

  return (
    <section id="about" ref={sectionRef} className={styles.about}>
      <div className={styles.bg} />

      <div className={styles.inner}>
        <SectionHeader title={t.about.title} subtitle={t.about.subtitle} />

        <div className={styles.grid}>
          {/* Terminal bio */}
          <ScrollReveal direction="left">
            <Terminal title="omar@sahragty:~">
              {/* key={lang} — remounts the component on language change, resetting typing state */}
              <TerminalBioContent key={lang} isInView={isInView} />
            </Terminal>
          </ScrollReveal>

          {/* Skills grid */}
          <div>
            <motion.div
              className={styles.skillsGrid}
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
            >
              {skillCategories.map((category) => (
                <motion.div key={category.title} variants={staggerChild}>
                  <Card glowColor={`${category.color}20`}>
                    <div className={`${styles.categoryCard} ${getThemeClass(category.color)}`}>
                      <h3 className={styles.categoryHeader}>
                        <span className={styles.categoryDot} />
                        {t.about.skills[category.title as keyof typeof t.about.skills] ??
                          category.title}
                      </h3>

                      <div className={styles.skillsList}>
                        {category.skills.map((skill) => {
                          const Icon = skill.icon;
                          return (
                            <span
                              key={skill.name}
                              className={`${styles.skillPill} ${getThemeClass(skill.color)}`}
                            >
                              <Icon size={12} className={styles.skillIcon} />
                              {skill.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
