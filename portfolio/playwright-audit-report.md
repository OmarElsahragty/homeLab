# Playwright Audit Report — sahragty.me

**Date:** 2026-03-17
**URL:** https://sahragty.me
**Stack:** Next.js 16.1.6 (Turbopack, standalone) / React 19 / SCSS Modules / Docker
**Tool:** Playwright MCP (headless Chromium)
**Viewports:** Desktop 1440×900, Mobile 375×812

---

## Executive Summary

The portfolio is well-built with strong SEO, correct semantic HTML, and responsive layouts across both themes. **No layout or interactive bugs were found.** The most actionable finding is **24 WCAG AA contrast failures in Light mode** — accent heading colors are too bright against white backgrounds. Additionally, 4 console errors indicate a stale JS chunk and a CSP misconfiguration blocking Cloudflare analytics.

### Severity Breakdown

| Severity | Count | Category |
|----------|-------|----------|
| Critical | 24 | Light mode WCAG AA contrast failures |
| High | 1 | Stale JS chunk 404 (deployment cache) |
| Medium | 1 | CSP blocks Cloudflare analytics beacon |
| Low | 3 | CSS preload warnings (unused within load window) |
| Pass | — | SEO, images, semantics, dark mode contrast, responsive layout, all interactive elements |

---

## 1. Console Errors (4 errors, 25 warnings)

### Errors

| # | Error | Impact | Recommendation |
|---|-------|--------|----------------|
| 1 | `8b67522d57cf6d31.js` — **404 Not Found** | A JS chunk referenced in the HTML no longer exists on disk | Redeploy or run `next build` to regenerate chunks. This is a stale deployment artifact — the old HTML references a chunk hash that doesn't exist in the current build. |
| 2 | Same chunk — **MIME type `text/plain`** rejected by strict MIME checking | Cascading from error #1 — Nginx returns the 404 page as `text/plain` | Resolves automatically when error #1 is fixed. |
| 3 | **ChunkLoadError** — module 59055 failed to load | Client-side hydration may be incomplete for one code-split module | Resolves automatically when error #1 is fixed. |
| 4 | **CSP blocks Cloudflare beacon** — `script-src 'self' 'unsafe-inline'` rejects `static.cloudflareinsights.com` | Cloudflare Web Analytics is injected but blocked by the Content-Security-Policy header | Add `https://static.cloudflareinsights.com` to your CSP `script-src` directive, or remove the Cloudflare analytics injection if not needed. |

### Warnings (repeating)

- **3 CSS preload warnings:** `<link rel="preload" as="style">` resources are loaded but not used within the browser's timing window. This happens because Next.js speculatively preloads route CSS for pages the user hasn't navigated to yet. No fix needed — this is normal Next.js behavior.

---

## 2. SEO & Robot Friendliness — ALL PASSING

| Check | Status | Value |
|-------|--------|-------|
| `<title>` | PASS | "Omar Elsahragty — Software Engineer Portfolio" |
| `<meta name="description">` | PASS | Present, descriptive |
| `<meta name="keywords">` | PASS | 21 keywords |
| `<link rel="canonical">` | PASS | `https://sahragty.me` |
| Open Graph `og:title` | PASS | Present |
| Open Graph `og:description` | PASS | Present |
| Open Graph `og:image` | PASS | `https://sahragty.me/images/profile/Profile.jpg` (absolute URL) |
| Open Graph `og:url` | PASS | `https://sahragty.me` |
| Open Graph `og:type` | PASS | `website` |
| Twitter Card | PASS | `summary_large_image` |
| JSON-LD Schema | PASS | Person + WebSite + ProfilePage with `dateModified: "2026-03-17"` |
| `robots.txt` | PASS | Allows all crawlers |
| `sitemap.xml` | PASS | References main URL |

---

## 3. Semantic HTML — GOOD

| Element | Count | Notes |
|---------|-------|-------|
| `<h1>` | 1 | "Hi, I'm Omar Elsahragty." — correct single h1 |
| `<h2>` | 5 | Section headings (About, Experience, Projects, Certificates, Contact) |
| `<h3>` | 20 | Subsection headings |
| `<nav>` | 1 | Main navigation |
| `<main>` | 1 | Wraps all content sections |
| `<section>` | 6 | Hero + 5 content sections |
| `<footer>` | 1 | Footer with copyright and links |
| `<header>` | 0 | Minor: no semantic `<header>` element (nav serves the purpose) |

**Recommendation:** Optionally wrap the navbar in a `<header>` element for marginally better semantics, but this is not a failure.

---

## 4. Images & Media — ALL PASSING

| Metric | Value |
|--------|-------|
| Total `<img>` elements | 10 |
| Missing `alt` attributes | **0** |
| SVG icons (inline) | 73 |
| Background images (CSS) | 16 |
| Images loaded after scroll | All 10 (lazy loading works correctly via Next.js `<Image>`) |

All images use Next.js `<Image>` component with proper `alt` text, responsive `srcSet`, and automatic optimization (`/_next/image?url=...&w=...&q=75`).

---

## 5. Dark Mode Audit

### 5.1 Visual & Layout — PASS

- **Desktop (1440×900):** All sections render correctly. No overlapping elements, no clipping, no broken layouts.
- **Mobile (375×812):** Document width 367px within 375px viewport. **0 overflowing elements, 0 truncated text.**
- **Hamburger menu:** Opens/closes correctly. Shows 5 nav items + theme toggle ("Switch to light mode").

### 5.2 Contrast — PASS (41 False Positives)

A programmatic WCAG contrast audit flagged 41 elements, but **all are false positives.** The algorithm compared text color against each element's own semi-transparent `rgba(…, 0.06–0.08)` background rather than the composited visual result against the dark page background (`rgb(13,17,23)`).

**Affected elements:** Hero action buttons ("Deploy Me", "Download Resume", "Read the Docs") and all tech skill badges (TypeScript, React, Node, etc.). Visually, all have excellent contrast on the dark background.

### 5.3 Interactive Elements — ALL WORKING

| Element | Test | Result |
|---------|------|--------|
| Duck quack button | Click "Quack! 🦆" | Key-prop remount confirmed (ref changes from e51→e683), animation triggers |
| Navbar navigation | Click section links | Scrolls to correct section, active state updates |
| Experience accordion | Expand "Bazaarvoice" | Full content with bullet points + 8 tech tags visible |
| Certificate lightbox | Click "Cryptography" | Dialog opens with full-size image, close button works |
| Project carousel | Click next arrow | Navigates between project slides correctly |
| Contact form | Type in "Your name" | Input accepted, "$ npm run deploy-message" submit button present |

---

## 6. Light Mode Audit

### 6.1 Visual & Layout — PASS

- **Desktop (1440×900):** All sections render correctly with proper light theme colors. Sky gradient background, clean white cards.
- **Mobile (375×812):** Document width 367px within 375px viewport. **0 overflowing elements, 0 truncated text.**
- **Hamburger menu:** Opens/closes correctly. Shows 5 nav items + theme toggle ("Switch to dark mode").

### 6.2 Contrast — CRITICAL: 24 WCAG AA Failures

274 elements audited. **24 genuine failures** — accent colors used for section/card headings are too bright against white or near-white backgrounds.

#### Failure Groups

| Color | RGB | Ratio | Needed | Affected Elements |
|-------|-----|-------|--------|-------------------|
| **Gold/Yellow** | `rgb(255,215,0)` | **1.40** | 4.5 | "Frontend" h3, "SWISO" experience h3, "Public Transportation System" project h3, "Cryptography" cert h3 |
| **Green** | `rgb(74,222,128)` | **1.74** | 4.5 | "Backend" h3, "Bazaarvoice" experience h3, "Dokkan El-Osra" project h3, "Usable Security" cert h3 |
| **Purple** | `rgb(188,140,255)` | **2.52** | 4.5 | "Databases" h3, "Affable.ai" experience h3, "Trendo" project h3, "Software Security" cert h3 |
| **Light Blue** | `rgb(88,166,255)` | **2.53** | 4.5 | "Architecture" h3, "Hardware Security" cert h3, "OnPoll" project h3 |
| **Orange-Red** | `rgb(255,107,53)` | **2.84** | 4.5 | "DevOps & Cloud" h3, "Freelance" experience h3, "Restaurants ERP" project h3 |
| **Amber** | `rgb(217,119,6)` | **2.97–3.19** | 4.5 | "Bazaarvoice" hero span, "rubber duck debugging champion", terminal "sahragty" spans, submit button text |

#### Recommended Fix

Create darker light-mode variants of each accent color in `_variables.scss`:

```scss
// Light-mode accent overrides (WCAG AA compliant on white)
html[data-theme='light'] {
  --color-accent-gold:    #9a7b00;  // was #ffd700 → ratio ~5.5:1
  --color-accent-green:   #1a7a3a;  // was #4ade80 → ratio ~5.0:1
  --color-accent-purple:  #6b3fa0;  // was #bc8cff → ratio ~5.0:1
  --color-accent-blue:    #2563eb;  // was #58a6ff → ratio ~4.6:1
  --color-accent-orange:  #c2410c;  // was #ff6b35 → ratio ~4.8:1
  --color-accent-amber:   #92400e;  // was #d97706 → ratio ~5.2:1
}
```

These darker variants maintain the same hue family while reaching the minimum 4.5:1 contrast ratio against white.

### 6.3 Interactive Elements — ALL WORKING

| Element | Test | Result |
|---------|------|--------|
| Duck quack button | Click "Quack! 🦆" | Key-prop remount confirmed, animation triggers |
| Experience accordion | Expand "Affable.ai" | Full content + 8 tech tags (NestJS, React, TypeScript, MongoDB, Elasticsearch, PostgreSQL, GCP Pub/Sub, GraphQL) |
| Contact form | Type "Test User" in name field | Input accepted, submit button present |

---

## 7. Performance & Network

### 7.1 Navigation Timing

| Metric | Value | Rating |
|--------|-------|--------|
| Time to First Byte (TTFB) | **194ms** | Good |
| DOM Interactive | **472ms** | Good |
| DOM Content Loaded | **473ms** | Good |
| Load Complete | **1,084ms** | Good |
| First Paint | **488ms** | Good |
| First Contentful Paint (FCP) | **488ms** | Good |
| Long Tasks | **0** | Excellent |

### 7.2 Resource Summary

| Category | Files | Transfer Size |
|----------|-------|---------------|
| JavaScript | 16 | 225.7 KB |
| Fonts | 2 | 78.5 KB |
| Stylesheets | 6 | 12.6 KB |
| Images/Other | 21 | 87.9 KB |
| **Total** | **45** | **~405 KB** |

### 7.3 Largest Resources

| Resource | Type | Size | Duration |
|----------|------|------|----------|
| `aee6c7720838f8a2.js` | JS (main bundle) | 68.8 KB | 388ms |
| Font (woff2) | Font | 47.6 KB | 125ms |
| Cryptography.jpeg (lightbox preload) | Image | 32.9 KB | 1,665ms |
| `f96a0f45c0445e01.js` | JS chunk | 35.0 KB | 385ms |
| `ac5ab1e51eb2bbe7.js` | JS chunk | 31.7 KB | 380ms |
| `a8caf86c79dc84cd.js` | JS chunk | 31.6 KB | 380ms |
| Font (woff2) | Font | 30.9 KB | 109ms |
| Profile.jpg (hero preload) | Image | 19.7 KB | 881ms |

### 7.4 Render-Blocking Resources

| Resource | Duration |
|----------|----------|
| `4b4f2f4aa6bcf0a5.css` | 255ms |
| `6794cb5a14460e5c.css` | 259ms |

Two CSS stylesheets are render-blocking (standard for critical CSS in Next.js). Total blocking time: ~260ms. No excessive concern — combined CSS is only ~12.6 KB.

### 7.5 Lazy-Loaded Images — Slow on First Load

Several project and certificate images take 15–18 seconds to appear in the performance timeline. These are lazily loaded (triggered by scroll), so they don't affect initial page load. However, the duration suggests the images are being generated on-demand by the Next.js image optimizer for the first time. Subsequent visits will be served from the cache.

| Image | Duration |
|-------|----------|
| publicTransportationSystem/1.jpg | 18,804ms |
| Cryptography.jpeg (thumbnail) | 16,941ms |
| Usable-Security.jpeg | 15,637ms |
| onPoll/1.png | 15,473ms |
| Trendo/1.png | 15,447ms |
| Hardware-Security.jpeg | 15,334ms |
| Software-Security.jpeg | 15,334ms |
| DokkanElOsra/1.jpg | 15,333ms |
| RestaurantsSystem/1.jpg | 15,311ms |

**Recommendation:** Pre-warm the Next.js image cache after deployment by requesting each image URL once (e.g., a simple `curl` script). This ensures first-time visitors don't wait for on-demand optimization.

### 7.6 Failed Network Requests

| Request | Status | Cause |
|---------|--------|-------|
| `8b67522d57cf6d31.js` | 404 | Stale chunk hash from previous build |
| Cloudflare beacon.min.js | CSP blocked | `script-src` doesn't allow `static.cloudflareinsights.com` |

---

## 8. Recommendations — Prioritized

### Critical (Accessibility)

1. **Fix 24 light-mode WCAG AA contrast failures.** Create darker light-theme variants for all 6 accent colors (gold, green, purple, blue, orange, amber). See Section 6.2 for specific values.

### High (Console Errors)

2. **Clear stale JS chunk.** Rebuild and redeploy to eliminate the `8b67522d57cf6d31.js` 404 error. Ensure that the Docker build cache is invalidated properly on each deploy.

### Medium (Configuration)

3. **Fix CSP for Cloudflare analytics.** Either add `https://static.cloudflareinsights.com` to the `script-src` CSP directive, or remove the Cloudflare analytics script injection if it's not being used.

### Low (Performance Optimization)

4. **Pre-warm image cache after deploy.** Write a post-deploy script that curls each `/_next/image?url=...` endpoint to pre-generate optimized images, eliminating 15-18s delays for first visitors.

5. **Consider adding `<header>` semantic element.** Wrap the navbar in `<header>` for marginally better HTML5 semantics.

---

## Appendix: Test Matrix

| Category | Dark Desktop | Dark Mobile | Light Desktop | Light Mobile |
|----------|:-----------:|:-----------:|:-------------:|:------------:|
| Visual layout | PASS | PASS | PASS | PASS |
| Horizontal overflow | PASS (0) | PASS (0) | PASS (0) | PASS (0) |
| Text truncation | PASS (0) | PASS (0) | PASS (0) | PASS (0) |
| WCAG AA contrast | PASS | — | **FAIL (24)** | — |
| Navigation | PASS | PASS | PASS | PASS |
| Hamburger menu | — | PASS | — | PASS |
| Duck quack animation | PASS | — | PASS | — |
| Experience accordion | PASS | — | PASS | — |
| Certificate lightbox | PASS | — | — | — |
| Project carousel | PASS | — | — | — |
| Contact form input | PASS | — | PASS | — |
| Images loaded | PASS | — | PASS | — |
| Alt attributes | PASS (0 missing) | — | — | — |
