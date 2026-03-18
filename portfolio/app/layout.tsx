import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Noto_Naskh_Arabic } from 'next/font/google';
import Navbar from '@/components/layout/Navbar/Navbar';
import FooterSection from '@/components/layout/Footer/Footer';
import DuckBackground from '@/components/canvas/DuckBackgroundCanvasWrapper';
import { LangProvider } from '@/contexts/LangContext';
import '@/styles/globals.scss';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#87CEEB',
};

export const metadata: Metadata = {
  title: {
    template: '%s | Omar Elsahragty',
    default: 'Omar Elsahragty — Software Engineer Portfolio',
  },
  description:
    'Omar Elsahragty (عمر الصهراجتي) — Software Engineer from Alexandria, Egypt, building distributed systems and scalable web platforms since 2018. Specialized in Scala, NestJS, React, TypeScript, and cloud infrastructure on AWS and GCP.',
  keywords: [
    'Omar Elsahragty',
    'عمر الصهراجتي',
    'Software Engineer',
    'مهندس برمجيات',
    'Backend Developer',
    'مطور واجهة خلفية',
    'Frontend Developer',
    'Full Stack Developer',
    'React',
    'Node.js',
    'TypeScript',
    'Scala',
    'NestJS',
    'GraphQL',
    'MongoDB',
    'PostgreSQL',
    'GCP',
    'AWS',
    'Docker',
    'Kubernetes',
    'Distributed Systems',
    'Microservices',
    'Alexandria Egypt',
    'الإسكندرية',
    'مصر',
    'Portfolio',
  ],
  authors: [{ name: 'Omar Elsahragty' }],
  creator: 'Omar Elsahragty',
  openGraph: {
    title: 'Omar Elsahragty (عمر الصهراجتي) — Software Engineer Portfolio',
    description:
      'Omar Elsahragty (عمر الصهراجتي) — Software Engineer from Alexandria, Egypt, building distributed systems and scalable web platforms since 2018.',
    url: 'https://sahragty.me',
    siteName: 'Omar Elsahragty',
    images: [
      {
        url: 'https://sahragty.me/images/profile/Profile.jpg',
        width: 1200,
        height: 630,
        alt: 'Omar Elsahragty (عمر الصهراجتي) — Software Engineer',
      },
    ],
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['ar_EG'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Omar Elsahragty (عمر الصهراجتي) — Software Engineer Portfolio',
    description:
      'Omar Elsahragty (عمر الصهراجتي) — Software Engineer from Alexandria, Egypt, building distributed systems and scalable web platforms since 2018.',
    images: ['/images/profile/Profile.jpg'],
  },
  alternates: {
    canonical: 'https://sahragty.me',
    languages: {
      en: 'https://sahragty.me',
      ar: 'https://sahragty.me',
    },
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/images/profile/Profile.jpg',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  category: 'technology',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sahragty.me'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoNaskhArabic.variable}`}
    >
      <head>
        {/* Anti-FOUC: read localStorage before first paint, and restore lang/dir */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}var l=localStorage.getItem('lang');if(!l){var bl=navigator.language||'';l=bl.toLowerCase().startsWith('ar')?'ar':'en';}document.documentElement.setAttribute('lang',l);document.documentElement.setAttribute('dir',l==='ar'?'rtl':'ltr');}catch(e){}})();`,
          }}
        />
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Person',
                  '@id': 'https://sahragty.me/#person',
                  name: 'Omar Elsahragty',
                  alternateName: ['عمر الصهراجتي', 'Omar El-Sahragty', 'Omar Elsahraghty'],
                  givenName: 'Omar',
                  familyName: 'Elsahragty',
                  url: 'https://sahragty.me',
                  image: {
                    '@type': 'ImageObject',
                    url: 'https://sahragty.me/images/profile/Profile.jpg',
                    width: 400,
                    height: 400,
                  },
                  jobTitle: 'Software Engineer',
                  description:
                    'Omar Elsahragty (عمر الصهراجتي) — Software Engineer from Alexandria, Egypt, building distributed systems and scalable web platforms since 2018. Specialized in Scala, NestJS, React, TypeScript, AWS, and GCP.',
                  nationality: { '@type': 'Country', name: 'Egypt' },
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Alexandria',
                    addressRegion: 'Alexandria Governorate',
                    addressCountry: 'EG',
                  },
                  worksFor: {
                    '@type': 'Organization',
                    name: 'Bazaarvoice',
                    url: 'https://www.bazaarvoice.com',
                  },
                  hasOccupation: {
                    '@type': 'Occupation',
                    name: 'Software Engineer',
                    occupationLocation: { '@type': 'City', name: 'Alexandria' },
                  },
                  knowsLanguage: [
                    { '@type': 'Language', name: 'English', alternateName: 'en' },
                    { '@type': 'Language', name: 'Arabic', alternateName: 'ar' },
                  ],
                  sameAs: [
                    'https://github.com/OmarElsahragty',
                    'https://www.linkedin.com/in/omar-elsahragty',
                  ],
                  knowsAbout: [
                    'Distributed Systems',
                    'Microservices',
                    'React',
                    'Node.js',
                    'TypeScript',
                    'Scala',
                    'NestJS',
                    'GraphQL',
                    'MongoDB',
                    'PostgreSQL',
                    'GCP',
                    'AWS',
                    'Docker',
                    'Kubernetes',
                    'Software Architecture',
                    'Cloud Infrastructure',
                  ],
                  mainEntityOfPage: {
                    '@type': 'WebPage',
                    '@id': 'https://sahragty.me',
                  },
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://sahragty.me/#website',
                  name: 'Omar Elsahragty',
                  url: 'https://sahragty.me',
                  inLanguage: ['en', 'ar'],
                  description: 'Omar Elsahragty (عمر الصهراجتي) — Software Engineer portfolio.',
                  author: { '@id': 'https://sahragty.me/#person' },
                },
                {
                  '@type': 'ProfilePage',
                  '@id': 'https://sahragty.me/#profilepage',
                  url: 'https://sahragty.me',
                  inLanguage: ['en', 'ar'],
                  mainEntity: { '@id': 'https://sahragty.me/#person' },
                  dateCreated: '2024-01-01',
                  dateModified: new Date().toISOString().split('T')[0],
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        <LangProvider>
          <DuckBackground />
          <Navbar />
          <main>{children}</main>
          <FooterSection />
        </LangProvider>
      </body>
    </html>
  );
}
