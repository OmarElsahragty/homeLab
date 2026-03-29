'use client';

import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader/SectionHeader';
import Card from '@/components/ui/Card/Card';
import ScrollReveal from '@/components/ui/ScrollReveal/ScrollReveal';
import { socialLinks } from '@/constants/data';
import { getThemeClass } from '@/utils/styleUtils';
import { useLang } from '@/contexts/LangContext';
import { FaGithub, FaLinkedin, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import type { FormStatus } from '@/types/components';
import type { SocialLink } from '@/types/data';
import styles from './Contact.module.scss';

export default function Contact() {
  const { t } = useLang();
  const [status, setStatus] = useState<FormStatus>('idle');
  const [form, setForm] = useState({ name: '', email: '', message: '', _honey: '' });

  const socials: SocialLink[] = [
    {
      icon: FaEnvelope,
      label: 'Email',
      value: socialLinks.email,
      href: `mailto:${socialLinks.email}`,
      color: '#FF6B35',
    },
    {
      icon: FaGithub,
      label: 'GitHub',
      value: '@OmarElsahragty',
      href: socialLinks.github,
      color: '#E0E0E0',
    },
    {
      icon: FaLinkedin,
      label: 'LinkedIn',
      value: 'omar-elsahragty',
      href: socialLinks.linkedin,
      color: '#0A66C2',
    },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('Failed to send');

      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setForm({ name: '', email: '', message: '', _honey: '' });
      }, 4000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <section id="contact" className={styles.contact}>
      <div className={styles.bg} />

      <div className={styles.inner}>
        <SectionHeader title={t.contact.title} subtitle={t.contact.subtitle} />

        <div className={styles.grid}>
          {/* Social links */}
          <ScrollReveal direction="left">
            <div className={styles.socialsCol}>
              <h3 className={styles.socialsTitle}>{t.contact.directConnections}</h3>

              {socials.map(({ icon: Icon, label, value, href, color }) => (
                <Card key={label} glowColor={`${color}20`}>
                  <a
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className={`${styles.socialCard} ${getThemeClass(color)}`}
                    aria-label={`${label}: ${value}`}
                  >
                    <div className={styles.socialIcon}>
                      <Icon size={18} className={styles.iconSvg} />
                    </div>
                    <div>
                      <p className={styles.socialLabel}>{label}</p>
                      <p className={styles.socialValue}>{value}</p>
                    </div>
                  </a>
                </Card>
              ))}

              <div className={styles.location}>
                <FaMapMarkerAlt size={14} />
                <span>{t.contact.location}</span>
              </div>
            </div>
          </ScrollReveal>

          {/* Contact form */}
          <ScrollReveal direction="right">
            <div className={styles.formWrap}>
              <div className={styles.formHeader}>
                <div className={`${styles.dot} ${styles.red}`} />
                <div className={`${styles.dot} ${styles.yellow}`} />
                <div className={`${styles.dot} ${styles.green}`} />
                <span className={styles.formTitle}>{t.contact.formTitle}</span>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <input
                  type="text"
                  name="_honey"
                  value={form._honey}
                  onChange={(e) => setForm({ ...form, _honey: e.target.value })}
                  autoComplete="off"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
                />
                <div className={styles.fields}>
                  <span className={styles.brace}>{'{'}</span>

                  <div className={styles.fieldRow}>
                    <label htmlFor="contact-name" className={styles.fieldLabel}>
                      {t.contact.name}
                    </label>
                    <span className={styles.fieldSep}>: </span>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t.contact.namePlaceholder}
                      className={styles.fieldInput}
                      aria-label="Your name"
                    />
                    <span className={styles.fieldComma}>,</span>
                  </div>

                  <div className={styles.fieldRow}>
                    <label htmlFor="contact-email" className={styles.fieldLabel}>
                      {t.contact.email}
                    </label>
                    <span className={styles.fieldSep}>: </span>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder={t.contact.emailPlaceholder}
                      className={styles.fieldInput}
                      aria-label="Your email"
                    />
                    <span className={styles.fieldComma}>,</span>
                  </div>

                  <div className={styles.fieldRow}>
                    <label htmlFor="contact-message" className={styles.fieldLabel}>
                      {t.contact.message}
                    </label>
                    <span className={styles.fieldSep}>: </span>
                    <textarea
                      id="contact-message"
                      required
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder={t.contact.messagePlaceholder}
                      className={styles.fieldTextarea}
                      aria-label="Your message"
                    />
                  </div>

                  <span className={styles.brace}>{'}'}</span>
                </div>

                <div className={styles.submitArea}>
                  <AnimatePresence mode="wait">
                    {status === 'idle' && (
                      <motion.button
                        key="submit"
                        type="submit"
                        className={styles.submitBtn}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {t.contact.submit}
                      </motion.button>
                    )}

                    {status === 'sending' && (
                      <motion.div
                        key="sending"
                        className={`${styles.statusMsg} ${styles.sending}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <span className={styles.pulse}>{t.contact.sending}</span>
                      </motion.div>
                    )}

                    {status === 'success' && (
                      <motion.div
                        key="success"
                        className={`${styles.statusMsg} ${styles.success}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {t.contact.success}
                      </motion.div>
                    )}

                    {status === 'error' && (
                      <motion.div
                        key="error"
                        className={`${styles.statusMsg} ${styles.error}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {t.contact.error}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </form>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
