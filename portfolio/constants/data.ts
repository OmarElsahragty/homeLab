// ============================================================================
// Portfolio Data — Omar Elsahragty
// All content, skills, projects, and experience data
// ============================================================================

import {
  SiReact,
  SiAngular,
  SiRedux,
  SiTypescript,
  SiJavascript,
  SiNextdotjs,
  SiNestjs,
  SiNodedotjs,
  SiGraphql,
  SiSocketdotio,
  SiScala,
  SiMongodb,
  SiPostgresql,
  SiMysql,
  SiApachecassandra,
  SiElasticsearch,
  SiRedis,
  SiDocker,
  SiKubernetes,
  SiGooglecloud,
  SiAmazonwebservices,
  SiTerraform,
  SiNginx,
  SiFirebase,
  SiGit,
  SiLinux,
} from 'react-icons/si';
import { HiCode } from 'react-icons/hi';
import type { IconType } from 'react-icons';
import type { SkillCategory, Experience, Project, Certificate } from '@/types/data';

// ---------- Tech Icon Map ----------
export const techIconMap: Record<string, { icon: IconType; color: string }> = {
  ReactJS: { icon: SiReact, color: '#61DAFB' },
  React: { icon: SiReact, color: '#61DAFB' },
  'React Native': { icon: SiReact, color: '#61DAFB' },
  'Next.js': { icon: SiNextdotjs, color: '#E2E8F0' },
  Angular: { icon: SiAngular, color: '#DD0031' },
  Redux: { icon: SiRedux, color: '#764ABC' },
  TypeScript: { icon: SiTypescript, color: '#3178C6' },
  JavaScript: { icon: SiJavascript, color: '#F7DF1E' },
  'Node.js': { icon: SiNodedotjs, color: '#339933' },
  NestJS: { icon: SiNestjs, color: '#E0234E' },
  GraphQL: { icon: SiGraphql, color: '#E10098' },
  'Socket.IO': { icon: SiSocketdotio, color: '#010101' },
  Scala: { icon: SiScala, color: '#DC322F' },
  MongoDB: { icon: SiMongodb, color: '#47A248' },
  PostgreSQL: { icon: SiPostgresql, color: '#4169E1' },
  MySQL: { icon: SiMysql, color: '#4479A1' },
  Cassandra: { icon: SiApachecassandra, color: '#1287B1' },
  Elasticsearch: { icon: SiElasticsearch, color: '#005571' },
  Redis: { icon: SiRedis, color: '#DC382D' },
  Docker: { icon: SiDocker, color: '#2496ED' },
  Kubernetes: { icon: SiKubernetes, color: '#326CE5' },
  GCP: { icon: SiGooglecloud, color: '#4285F4' },
  AWS: { icon: SiAmazonwebservices, color: '#FF9900' },
  Terraform: { icon: SiTerraform, color: '#7B42BC' },
  Nginx: { icon: SiNginx, color: '#009639' },
  Firebase: { icon: SiFirebase, color: '#FFCA28' },
  Git: { icon: SiGit, color: '#F05032' },
  Linux: { icon: SiLinux, color: '#FCC624' },
};

// ---------- Skills ----------
export const skillCategories: SkillCategory[] = [
  {
    title: 'Frontend',
    color: '#FFD700',
    skills: [
      { name: 'React', icon: SiReact, color: '#61DAFB' },
      { name: 'Next.js', icon: SiNextdotjs, color: '#E2E8F0' },
      { name: 'Angular', icon: SiAngular, color: '#DD0031' },
      { name: 'React Native', icon: SiReact, color: '#61DAFB' },
      { name: 'Redux', icon: SiRedux, color: '#764ABC' },
      { name: 'TypeScript', icon: SiTypescript, color: '#3178C6' },
      { name: 'JavaScript', icon: SiJavascript, color: '#F7DF1E' },
    ],
  },
  {
    title: 'Backend',
    color: '#4ADE80',
    skills: [
      { name: 'Node.js', icon: SiNodedotjs, color: '#339933' },
      { name: 'NestJS', icon: SiNestjs, color: '#E0234E' },
      { name: 'REST APIs', icon: HiCode, color: '#FF6B35' },
      { name: 'GraphQL', icon: SiGraphql, color: '#E10098' },
      { name: 'Socket.IO', icon: SiSocketdotio, color: '#010101' },
      { name: 'Scala', icon: SiScala, color: '#DC322F' },
    ],
  },
  {
    title: 'Databases',
    color: '#BC8CFF',
    skills: [
      { name: 'MongoDB', icon: SiMongodb, color: '#47A248' },
      { name: 'PostgreSQL', icon: SiPostgresql, color: '#4169E1' },
      { name: 'MySQL', icon: SiMysql, color: '#4479A1' },
      { name: 'Cassandra', icon: SiApachecassandra, color: '#1287B1' },
      { name: 'Elasticsearch', icon: SiElasticsearch, color: '#005571' },
      { name: 'Redis', icon: SiRedis, color: '#DC382D' },
    ],
  },
  {
    title: 'DevOps & Cloud',
    color: '#FF6B35',
    skills: [
      { name: 'Docker', icon: SiDocker, color: '#2496ED' },
      { name: 'Kubernetes', icon: SiKubernetes, color: '#326CE5' },
      { name: 'GCP', icon: SiGooglecloud, color: '#4285F4' },
      { name: 'AWS', icon: SiAmazonwebservices, color: '#FF9900' },
      { name: 'Terraform', icon: SiTerraform, color: '#7B42BC' },
      { name: 'Nginx', icon: SiNginx, color: '#009639' },
      { name: 'Firebase', icon: SiFirebase, color: '#FFCA28' },
      { name: 'Git', icon: SiGit, color: '#F05032' },
      { name: 'Linux', icon: SiLinux, color: '#FCC624' },
    ],
  },
  {
    title: 'Architecture',
    color: '#58A6FF',
    skills: [
      { name: 'MVC', icon: HiCode, color: '#58A6FF' },
      { name: 'DDD', icon: HiCode, color: '#BC8CFF' },
      { name: 'Microservices', icon: HiCode, color: '#4ADE80' },
      { name: 'Message Broker', icon: HiCode, color: '#FF6B35' },
      { name: 'Atomic Design', icon: HiCode, color: '#FFD700' },
      { name: 'CI/CD', icon: HiCode, color: '#58A6FF' },
    ],
  },
];

// ---------- Experience ----------
export const experiences: Experience[] = [
  {
    hash: 'a3f7b2e',
    date: 'Jan 2024 – Present',
    role: 'Software Engineer',
    company: 'Bazaarvoice',
    type: 'Full-time',
    duration: '2+ years',
    color: '#4ADE80',
    isCurrent: true,
    details: [
      'Maintain and evolve the multi-tenant Curalate SaaS platform serving 3,000+ global brands — a fleet of 20+ Scala microservices on Finatra/Finagle, deployed on AWS ECS with per-tenant data isolation and zero-downtime rolling deployments',
      'Engineered the cross-platform bridge service post-acquisition: bidirectional translation between Curalate Scala APIs and Affable NestJS contracts, enabling seamless product unification across two fundamentally different codebases and data models',
      'Designed and maintained async event pipelines on GCP Pub/Sub processing influencer campaign workflows — fan-out patterns across MongoDB Atlas and Cassandra clusters handling bursty workloads at scale with guaranteed delivery and dead-letter queue recovery',
      'Drove full-stack feature development across the Affable platform — Fluence analytics dashboard with real-time charting, Creator Discovery powered by Elasticsearch across 10M+ social profiles, and sequence-runner worker patterns for reliable background job processing',
      'Refactored critical GraphQL resolvers and introduced multi-layer Redis caching with TTL-based invalidation, measurably cutting P95 API latency on the platform highest-traffic routes',
    ],
    tech: [
      'Scala',
      'NestJS',
      'TypeScript',
      'React',
      'Finatra',
      'GCP',
      'AWS',
      'Cassandra',
      'MongoDB',
      'GraphQL',
      'Redis',
    ],
  },
  {
    hash: 'e9c1d4a',
    date: 'Nov 2021 – Jan 2024',
    role: 'Software Engineer',
    company: 'Affable.ai',
    type: 'Full-time',
    duration: '2 years 3 months',
    color: '#58A6FF',
    isCurrent: false,
    details: [
      'Built the Fluence influencer analytics dashboard from the ground up (0 → 1): a React SPA with interactive charting, a NestJS GraphQL API layer with DataLoader batching, and MongoDB Atlas for flexible document storage — adopted by 500+ brand customers with daily active usage within 6 months of launch',
      'Implemented the Creator Discovery engine — an Elasticsearch-powered search system across 10M+ social profiles with faceted filtering, BM25 relevancy scoring, audience demographic breakdowns, and sub-200ms query response times',
      'Architected GCP Pub/Sub sequence-runner workers for async campaign processing — replacing fragile cron jobs with a fault-tolerant fanout pattern that gracefully handles burst traffic, supports retry with exponential backoff, and guarantees at-least-once delivery without data loss',
      'Led the full codebase migration from JavaScript to TypeScript across 200+ source files, establishing strict type-safe API contracts and cutting the production bug rate in the data ingestion layer by eliminating runtime type errors',
      'Mentored 2 junior engineers through structured code reviews, pair programming sessions, and API design workshops — established team-wide OpenAPI documentation standards and contributed to the internal engineering onboarding playbook',
    ],
    tech: [
      'NestJS',
      'React',
      'TypeScript',
      'MongoDB',
      'Elasticsearch',
      'PostgreSQL',
      'GCP Pub/Sub',
      'GraphQL',
    ],
  },
  {
    hash: '7b3f8c2',
    date: 'Mar 2021 – Nov 2021',
    role: 'Software Engineer',
    company: 'SWISO Software Development',
    type: 'Full-time',
    duration: '9 months',
    color: '#FFD700',
    isCurrent: false,
    details: [
      'Delivered a comprehensive Restaurants ERP system covering end-to-end operations: inventory management with cross-branch stock transfers, multi-terminal POS with kitchen display integration, staff scheduling with shift planning, and automated P&L reporting — replacing 3 disconnected spreadsheet workflows for chain managers',
      'Built the Public Transportation GPS tracking system from scratch: real-time vehicle positioning via Socket.IO WebSocket connections, dynamic route ETAs calculated from historical speed data, and passenger-facing arrival estimates — supporting 1,000+ concurrent mobile clients with efficient room-based broadcasting',
      'Designed and maintained Node.js REST APIs backed by MongoDB with JWT authentication middleware, IP-based rate limiting, request validation with structured schemas, and consistent error handling with standardized API response envelopes',
    ],
    tech: ['React', 'Node.js', 'MongoDB', 'Socket.IO', 'REST APIs'],
  },
  {
    hash: 'd2a6e1f',
    date: 'Nov 2020 – Feb 2021',
    role: 'Frontend Developer',
    company: 'Inova',
    type: 'Full-time',
    duration: '4 months',
    color: '#BC8CFF',
    isCurrent: false,
    details: [
      'Translated Figma design mockups into pixel-perfect React components for enterprise SaaS products, matching design specs down to shadow values, spacing tokens, and responsive breakpoints with a mobile-first approach',
      'Implemented Redux state machines for complex multi-step form workflows featuring rollback capability, draft persistence to localStorage, real-time field validation, and optimistic UI updates for a fluid user experience',
      'Achieved measurable Core Web Vitals improvements (LCP, CLS, FID) through lazy-loading heavy component trees with React.lazy and Suspense, deferring non-critical third-party scripts, and optimizing image delivery with responsive srcsets and modern formats',
    ],
    tech: ['React', 'JavaScript', 'CSS', 'Redux'],
  },
  {
    hash: 'c5b9a3d',
    date: 'Oct 2018 – Jun 2023',
    role: 'Freelance Software Developer',
    company: 'Self-employed',
    type: 'Freelance',
    duration: '4 years 9 months',
    color: '#FF6B35',
    isCurrent: false,
    details: [
      'Shipped 10+ production full-stack applications independently — React SPAs, Node.js REST APIs, real-time dashboards with WebSocket, and e-commerce platforms — across diverse client verticals including fintech, retail, and food service',
      'Built Trendo (a social trading platform for the Saudi stock market with real-time Firebase Firestore feeds reaching 1,000+ beta users) and Dokkan El-Osra (a multi-vendor e-commerce dashboard managing 50+ vendor storefronts) — both maintained active user bases post-launch',
      'Managed the full software development lifecycle solo: requirements gathering with stakeholders, system architecture design, iterative development with client demos, cloud deployment on Firebase and GCP, QA testing, and comprehensive client handover documentation',
    ],
    tech: ['React', 'Node.js', 'MongoDB', 'Firebase', 'PostgreSQL', 'Socket.IO'],
  },
];

// ---------- Projects ----------
export const projects: Project[] = [
  {
    title: 'OnPoll',
    description:
      'A real-time live polling and audience engagement platform built for instant feedback at scale. Votes synchronize in under 50ms through WebSocket connections, with Redis Pub/Sub handling fanout distribution across server instances so every connected client sees results update simultaneously. PostgreSQL provides durable vote persistence with conflict-free counting, while the React frontend delivers animated result bars, countdown timers, and shareable poll links. Designed with a WebRTC-ready architecture for future live video integration during polling sessions.',
    tech: ['ReactJS', 'Socket.IO', 'Node.js', 'Redis', 'PostgreSQL'],
    color: '#58A6FF',
    images: Array.from({ length: 5 }, (_, i) => `/images/projects/onPoll/${i + 1}.png`),
  },
  {
    title: 'Trendo',
    description:
      'A social trading community platform purpose-built for the Saudi Arabian (Tadawul) stock market — Twitter meets StockTwits with a Middle Eastern focus. Traders share real-time market insights, follow specific tickers, post analysis threads, and react to price movements with sentiment-tagged posts. The real-time feed is powered by Firebase Firestore with optimistic UI updates for instant post visibility. Features include user profiles with trading track records, ticker watchlists with push alerts, threaded discussions, and a trending sentiment dashboard. Reached 1,000+ active beta users within two weeks of launch.',
    tech: ['ReactJS', 'Firebase'],
    color: '#BC8CFF',
    images: Array.from({ length: 19 }, (_, i) => `/images/projects/Trendo/${i + 1}.png`),
  },
  {
    title: 'Dokkan El-Osra',
    description:
      'A multi-vendor e-commerce administration dashboard designed to unify the management of 50+ independent vendor storefronts from a single React interface. The platform provides real-time order management with status tracking across vendors, inventory monitoring with low-stock alerts, vendor performance analytics with revenue breakdowns and fulfillment metrics, and a customer CRM with order history and communication logs. Built as a single-page application with zero page reloads, leveraging optimistic updates and client-side caching for a seamless operator experience.',
    tech: ['ReactJS'],
    color: '#4ADE80',
    images: Array.from({ length: 20 }, (_, i) => `/images/projects/DokkanElOsra/${i + 1}.jpg`),
  },
  {
    title: 'Restaurants ERP System',
    description:
      'A comprehensive enterprise resource planning system built for multi-branch restaurant chains, replacing three disconnected spreadsheet workflows with a single real-time dashboard. Covers end-to-end operations: inventory tracking with cross-branch stock transfers and waste logging, a multi-terminal point-of-sale system with kitchen display integration, staff scheduling with shift management and overtime calculations, and detailed profit-and-loss reporting with per-branch breakdowns. Built with React and Redux on the frontend, Node.js REST APIs on the backend, and MongoDB for flexible document storage.',
    tech: ['ReactJS', 'Redux', 'MongoDB', 'Node.js'],
    color: '#FF6B35',
    images: Array.from({ length: 8 }, (_, i) => `/images/projects/RestaurantsSystem/${i + 1}.jpg`),
  },
  {
    title: 'Public Transportation System',
    description:
      'A GPS-powered fleet management and passenger information system for public transit networks. Tracks live vehicle positions via Socket.IO WebSocket connections, calculates dynamic route ETAs using historical speed data, and broadcasts passenger-facing arrival estimates to mobile clients. The WebSocket layer efficiently handles 1,000+ concurrent connections with minimal server overhead through connection pooling and selective room-based broadcasting. Features a dispatcher dashboard with fleet overview, route deviation alerts, and historical route analytics.',
    tech: ['Real-time Systems', 'Socket.IO', 'Node.js'],
    color: '#FFD700',
    caseStudy: '/documents/Public-Transportation-System.pdf',
    images: Array.from(
      { length: 8 },
      (_, i) => `/images/projects/publicTransportationSystem/${i + 1}.jpg`
    ),
  },
];

// ---------- Social Links ----------
export const socialLinks = {
  email: 'omar@sahragty.me',
  github: 'https://github.com/OmarElsahragty',
  linkedin: 'https://linkedin.com/in/omar-elsahragty',
} as const;

// ---------- Funny Quotes & Easter Eggs ----------
export const funnyQuotes = [
  'It works on my machine ¯\\_(ツ)_/¯',
  'Turning coffee into code and bugs into undocumented features',
  "If it's stupid but it works, it's not stupid",
  'Rubber duck debugging champion 🏆',
  "console.log('Why isn\\'t it working?'); // [object Object]",
  '// TODO: Refactor this later (created 3 years ago)',
  'git commit -m "fixed it for real this time"',
  '404: Social life not found',
] as const;

export const terminalBio = `Computer Engineer from Alexandria, Egypt — building and shipping distributed systems since 2018. Currently a Software Engineer at Bazaarvoice, maintaining a multi-tenant SaaS platform that serves 3,000+ global brands across 20+ Scala microservices on AWS ECS, orchestrating async event pipelines over GCP Pub/Sub, and wrangling more GraphQL resolvers than any sane person should. Before that, I built the Affable.ai influencer analytics platform from the ground up — Elasticsearch-powered discovery across 10M+ social profiles, MongoDB Atlas clusters, and NestJS APIs at scale. I thrive at the intersection of backend architecture and developer experience. Stack of choice: Scala + NestJS + React. Preferred debugger: a rubber duck named Kevin. 🦆`;

// ---------- Certificates ----------
export const certificates: Certificate[] = [
  {
    title: 'Cryptography',
    issuer: 'University of Maryland',
    image: '/images/certificates/Cryptography.jpeg',
    color: '#FFD700',
  },
  {
    title: 'Hardware Security',
    issuer: 'University of Maryland',
    image: '/images/certificates/Hardware-Security.jpeg',
    color: '#58A6FF',
  },
  {
    title: 'Software Security',
    issuer: 'University of Maryland',
    image: '/images/certificates/Software-Security.jpeg',
    color: '#BC8CFF',
  },
  {
    title: 'Usable Security',
    issuer: 'University of Maryland',
    image: '/images/certificates/Usable-Security.jpeg',
    color: '#4ADE80',
  },
];
