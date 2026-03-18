import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sahragty.me';

  return {
    rules: [
      // ── Explicitly welcome search & social crawlers ──────────────────────
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Googlebot-Image', allow: '/' },
      { userAgent: 'bingbot', allow: '/' },
      { userAgent: 'Slurp', allow: '/' },
      { userAgent: 'DuckDuckBot', allow: '/' },
      { userAgent: 'LinkedInBot', allow: '/' },
      { userAgent: 'Twitterbot', allow: '/' },
      { userAgent: 'facebookexternalhit', allow: '/' },
      { userAgent: 'Applebot', allow: '/' },
      // ── Allow all other legitimate crawlers, block internal paths ────────
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
      // ── Disallow AI-training & data-harvesting bots ──────────────────────
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'ChatGPT-User', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'Amazonbot', disallow: '/' },
      { userAgent: 'Bytespider', disallow: '/' },
      { userAgent: 'Applebot-Extended', disallow: '/' },
      { userAgent: 'meta-externalagent', disallow: '/' },
      { userAgent: 'PerplexityBot', disallow: '/' },
      { userAgent: 'YouBot', disallow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
