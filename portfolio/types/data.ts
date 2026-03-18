import type { IconType } from 'react-icons';

// ---------- Skills ----------
export interface Skill {
  name: string;
  icon: IconType;
  color: string;
}

export interface SkillCategory {
  title: string;
  color: string;
  skills: Skill[];
}

// ---------- Experience ----------
export interface Experience {
  hash: string;
  date: string;
  role: string;
  company: string;
  type: string;
  duration: string;
  color: string;
  isCurrent: boolean;
  details: string[];
  tech: string[];
}

// ---------- Projects ----------
export interface Project {
  title: string;
  description: string;
  tech: string[];
  color: string;
  github?: string;
  caseStudy?: string;
  images: string[];
}

// ---------- Certificates ----------
export interface Certificate {
  title: string;
  issuer: string;
  image: string;
  color: string;
}

// ---------- Social Links ----------
export interface SocialLink {
  icon: IconType;
  label: string;
  value: string;
  href: string;
  color: string;
}
