'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TypingTextProps } from '@/types/components';
import styles from './TypingText.module.scss';

/**
 * Animated typing effect component.
 *
 * ⚠️ IMPORTANT: When using TypingText with language-dependent content (i18n),
 * always wrap it in a parent element keyed by language:
 *
 * ❌ DON'T:
 *   <TypingText text={t.greeting} />  // Bad: state persists when language changes
 *
 * ✅ DO:
 *   <div key={lang}>
 *     <TypingText text={t.greeting} />  // Good: remounts on language change
 *   </div>
 *
 * Without the key, when languages switch, the component's internal state
 * (displayed text, animation progress) won't reset, causing both languages
 * to appear simultaneously and breaking the typing animation.
 */
export default function TypingText({
  text,
  speed = 40,
  delay = 0,
  className,
  showCursor = true,
  onComplete,
}: TypingTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  const completionFiredRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const stableOnComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!started || displayed.length >= text.length) {
      if (started && displayed.length >= text.length && !completionFiredRef.current) {
        completionFiredRef.current = true;
        stableOnComplete();
      }
      return;
    }
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [displayed, started, text, speed, stableOnComplete]);

  const isDone = started && displayed.length >= text.length;

  return (
    <span className={`${styles.typing} ${className ?? ''}`}>
      {displayed}
      {showCursor && !isDone && <span className={styles.cursor}>▊</span>}
    </span>
  );
}
