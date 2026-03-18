'use client';

import { socialLinks } from '@/constants/data';
import { useState, useEffect } from 'react';
import { useLang } from '@/contexts/LangContext';
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';
import styles from './Footer.module.scss';

export default function FooterSection() {
  const { t } = useLang();
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % t.footer.quotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [t.footer.quotes.length]);

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.info}>
            <p className={styles.quote}>{`// ${t.footer.quotes[quoteIndex]}`}</p>
            <p className={styles.tagline}>{t.footer.tagline}</p>
          </div>

          <p className={styles.copyright}>
            © {new Date().getFullYear()} {t.footer.copyright}
          </p>

          <div className={styles.socials}>
            <a
              href={socialLinks.github}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="GitHub profile"
            >
              <FaGithub size={18} />
            </a>
            <a
              href={socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="LinkedIn profile"
            >
              <FaLinkedin size={18} />
            </a>
            <a
              href={`mailto:${socialLinks.email}`}
              className={styles.socialLink}
              aria-label="Send email"
            >
              <FaEnvelope size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
