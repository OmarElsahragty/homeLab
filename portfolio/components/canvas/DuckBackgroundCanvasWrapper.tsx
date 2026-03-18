'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const DuckBackgroundCanvas = dynamic(() => import('./DuckBackgroundCanvas'), { ssr: false });

export default function DuckBackgroundCanvasWrapper() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return <DuckBackgroundCanvas ducksCount={7} isDark={isDark} />;
}
