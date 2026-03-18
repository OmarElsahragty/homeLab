'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiGlobe } from 'react-icons/fi';
import ThemeToggle from '@/components/ui/ThemeToggle/ThemeToggle';
import { useLang } from '@/contexts/LangContext';
import styles from './Navbar.module.scss';

const NAV_IDS = ['hero', 'about', 'experience', 'projects', 'contact'] as const;
type NavId = (typeof NAV_IDS)[number];

export default function Navbar() {
  const { t, lang, setLang, isRTL } = useLang();
  const [active, setActive] = useState<NavId>('hero');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'hero' as NavId, label: t.nav.home },
    { id: 'about' as NavId, label: t.nav.about },
    { id: 'experience' as NavId, label: t.nav.experience },
    { id: 'projects' as NavId, label: t.nav.projects },
    { id: 'contact' as NavId, label: t.nav.contact },
  ];

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 50);

    const sections = NAV_IDS.map((id) => document.querySelector(`#${id}`)).filter(
      Boolean
    ) as HTMLElement[];

    for (let i = sections.length - 1; i >= 0; i--) {
      if (sections[i].getBoundingClientRect().top <= 150) {
        setActive(NAV_IDS[i]);
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollTo = (id: string) => {
    document.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en');

  return (
    <header>
      <motion.nav
        className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.inner}>
          <button
            onClick={() => scrollTo('hero')}
            className={styles.logo}
            aria-label="Scroll to top"
          >
            {'<Sahragty />'}
          </button>

          <ul className={styles.desktopLinks}>
            {navItems.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => scrollTo(item.id)}
                    className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                    aria-label={`Navigate to ${item.label}`}
                  >
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className={styles.activeIndicator}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
            <li>
              <button
                onClick={toggleLang}
                className={styles.langToggle}
                aria-label={isRTL ? 'Switch to English' : 'Switch to Arabic'}
                title={isRTL ? 'Switch to English' : 'Switch to Arabic'}
              >
                <FiGlobe size={16} />
              </button>
            </li>
            <li>
              <ThemeToggle />
            </li>
          </ul>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={styles.hamburger}
            aria-label="Toggle navigation menu"
          >
            <motion.span
              className={styles.hamburgerLine}
              animate={{ rotate: mobileOpen ? 45 : 0, y: mobileOpen ? 8 : 0 }}
            />
            <motion.span
              className={styles.hamburgerLine}
              animate={{ opacity: mobileOpen ? 0 : 1 }}
            />
            <motion.span
              className={styles.hamburgerLine}
              animate={{ rotate: mobileOpen ? -45 : 0, y: mobileOpen ? -8 : 0 }}
            />
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              className={styles.mobileMenu}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ul className={styles.mobileLinks}>
                {navItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => scrollTo(item.id)}
                      className={`${styles.mobileItem} ${active === item.id ? styles.active : ''}`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
                <li className={styles.mobileToggle}>
                  <button
                    onClick={toggleLang}
                    className={styles.langToggle}
                    aria-label={isRTL ? 'Switch to English' : 'Switch to Arabic'}
                  >
                    <FiGlobe size={16} />
                  </button>
                </li>
                <li className={styles.mobileToggle}>
                  <ThemeToggle />
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </header>
  );
}
