'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader/SectionHeader';
import Card from '@/components/ui/Card/Card';
import Lightbox from '@/components/ui/Lightbox/Lightbox';
import { certificates } from '@/constants/data';
import { staggerContainer, staggerChild } from '@/constants/animations';
import { getThemeClass } from '@/utils/styleUtils';
import { useLang } from '@/contexts/LangContext';
import styles from './Certificates.module.scss';

export default function Certificates() {
  const { t } = useLang();
  const [lightbox, setLightbox] = useState<{ images: string[]; title: string } | null>(null);

  return (
    <section id="certificates" className={styles.certificates}>
      <div className={styles.bg} />

      <div className={styles.inner}>
        <SectionHeader title={t.certificates.title} subtitle={t.certificates.subtitle} />

        <motion.div
          className={styles.grid}
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {certificates.map((cert) => (
            <motion.div key={cert.title} variants={staggerChild}>
              <Card glowColor={`${cert.color}15`}>
                <div className={`${styles.certCard} ${getThemeClass(cert.color)}`}>
                  <button
                    className={styles.certImage}
                    onClick={() => setLightbox({ images: [cert.image], title: cert.title })}
                    aria-label={`View ${cert.title} certificate`}
                  >
                    <Image
                      src={cert.image}
                      alt={cert.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 300px"
                      className={styles.image}
                    />
                  </button>
                  <div className={styles.certInfo}>
                    <h3 className={styles.certTitle}>{cert.title}</h3>
                    <p className={styles.certIssuer}>{cert.issuer}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <Lightbox
            images={lightbox.images}
            current={0}
            alt={lightbox.title}
            onClose={() => setLightbox(null)}
            onNavigate={() => {
              // Single-image lightbox — navigation intentionally disabled
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
