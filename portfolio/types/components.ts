import type { ReactNode } from 'react';

export type FormStatus = 'idle' | 'sending' | 'success' | 'error';

export interface LightboxProps {
  images: string[];
  current: number;
  alt?: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export interface CardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export interface ButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'blue' | 'purple' | 'green' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

export interface TerminalProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  align?: 'left' | 'center';
}

export interface TypingTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  showCursor?: boolean;
  onComplete?: () => void;
}

export interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
}
