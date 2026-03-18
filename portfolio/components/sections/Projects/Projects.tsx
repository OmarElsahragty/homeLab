'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader/SectionHeader';
import Card from '@/components/ui/Card/Card';
import Lightbox from '@/components/ui/Lightbox/Lightbox';
import { projects, techIconMap } from '@/constants/data';
import { staggerContainer, staggerChild } from '@/constants/animations';
import { getThemeClass } from '@/utils/styleUtils';
import { useLang } from '@/contexts/LangContext';
import { HiCode } from 'react-icons/hi';
import {
  FaGithub,
  FaExternalLinkAlt,
  FaChevronLeft,
  FaChevronRight,
  FaExpand,
} from 'react-icons/fa';
import styles from './Projects.module.scss';

function ProjectImageCarousel({
  images,
  title,
  color,
  onOpenLightbox,
}: {
  images: string[];
  title: string;
  color: string;
  onOpenLightbox: (index: number) => void;
}) {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) return null;

  const prev = () => setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));

  return (
    <div className={styles.carousel}>
      <div className={styles.carouselImage}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={styles.imageWrapper}
          >
            <Image
              src={images[current]}
              alt={`${title} screenshot ${current + 1}`}
              fill
              sizes="(max-width: 640px) 100vw, 560px"
              className={styles.projectImage}
            />
          </motion.div>
        </AnimatePresence>

        {/* Expand / lightbox trigger */}
        <button
          onClick={() => onOpenLightbox(current)}
          className={styles.expandBtn}
          aria-label={`View ${title} image fullscreen`}
        >
          <FaExpand size={11} />
        </button>

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className={`${styles.carouselBtn} ${styles.carouselBtnLeft}`}
              aria-label="Previous image"
            >
              <FaChevronLeft size={10} />
            </button>
            <button
              onClick={next}
              className={`${styles.carouselBtn} ${styles.carouselBtnRight}`}
              aria-label="Next image"
            >
              <FaChevronRight size={10} />
            </button>
            <div className={styles.carouselDots}>
              {images.length <= 10 ? (
                images.map((_, i) => (
                  <button
                    key={i}
                    className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
                    style={
                      i === current ? ({ '--dot-color': color } as React.CSSProperties) : undefined
                    }
                    onClick={() => setCurrent(i)}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))
              ) : (
                <span className={styles.counter}>
                  {current + 1}/{images.length}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Projects() {
  const { lang } = useLang();
  const { t } = useLang();
  const [lightbox, setLightbox] = useState<{
    images: string[];
    index: number;
    title: string;
  } | null>(null);

  return (
    <section id="projects" className={styles.projects}>
      <div className={styles.bg} />

      <div className={styles.inner}>
        <SectionHeader title={t.projects.title} subtitle={t.projects.subtitle} />

        {/* key={lang} on content ensures lightbox and carousel states reset on language change */}
        <ProjectsContent
          key={lang}
          onOpenLightbox={(images, index, title) => setLightbox({ images, index, title })}
        />

        <p className={styles.easter}>
          {'// 404: More projects not found. Check back after the next hackathon.'}
        </p>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <Lightbox
            images={lightbox.images}
            current={lightbox.index}
            alt={lightbox.title}
            onClose={() => setLightbox(null)}
            onNavigate={(index) => setLightbox((prev) => (prev ? { ...prev, index } : null))}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * Isolated projects grid display component.
 * Keyed by lang (via parent) to reset carousel states on language change.
 */
function ProjectsContent({
  onOpenLightbox,
}: {
  onOpenLightbox: (images: string[], index: number, title: string) => void;
}) {
  const { t } = useLang();

  return (
    <motion.div
      className={styles.grid}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
    >
      {projects.map((project, index) => (
        <motion.div key={project.title} variants={staggerChild}>
          <Card glowColor={`${project.color}15`}>
            <div className={styles.cardInner}>
              <ProjectImageCarousel
                images={project.images}
                title={project.title}
                color={project.color}
                onOpenLightbox={(i) => onOpenLightbox(project.images, i, project.title)}
              />

              <div className={styles.cardBody}>
                <div className={`${styles.cardHeader} ${getThemeClass(project.color)}`}>
                  <div className={styles.cardDot} />
                  <h3 className={styles.cardTitle}>{project.title}</h3>
                </div>

                <p className={styles.cardDesc}>{t.projectItems[index].description}</p>

                <div className={styles.techBadges}>
                  {project.tech.map((tech) => {
                    const entry = techIconMap[tech];
                    const Icon = entry?.icon ?? HiCode;
                    const color = entry?.color;
                    return (
                      <span
                        key={tech}
                        className={styles.techBadge}
                        title={tech}
                        style={color ? { color } : undefined}
                      >
                        <Icon />
                      </span>
                    );
                  })}
                </div>

                <div className={styles.cardActions}>
                  {project.github && (
                    <a
                      href={project.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.cardLink}
                      aria-label={`View ${project.title} source on GitHub`}
                    >
                      <FaGithub size={12} />
                      {t.projects.viewCode}
                    </a>
                  )}
                  {project.caseStudy && (
                    <a
                      href={project.caseStudy}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.cardLinkPurple}
                      aria-label={`Read case study for ${project.title}`}
                    >
                      <FaExternalLinkAlt size={10} />
                      {t.projects.caseStudy}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
