/**
 * Generate site-level artifacts from the SAME source the HTML build uses.
 *
 * SPEC-004 FR-11..14 (llms.txt must be generated from real content),
 * FR-15..18 (robots.txt must explicitly allow OAI-SearchBot, GPTBot decision
 * documented), FR-19 (structured-data source data).
 *
 * Writes apps/web/public/{llms.txt, robots.txt, sitemap.xml} so Next copies
 * them into out/ untouched.
 *
 * Usage: node apps/web/scripts/generate-artifacts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const WEB = join(ROOT, 'apps', 'web')
const dataPath = join(WEB, 'data', 'products.json')
const products = JSON.parse(readFileSync(dataPath, 'utf8')).products
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.pages.dev'

mkdirSync(join(WEB, 'public'), { recursive: true })

// ------------------------------------------------------------- llms.txt (FR-11..14)
const lines = [
  '# Affiliate Price Intelligence',
  '> Honest price history and landed-cost answers from the affiliate feed. Safety-critical categories are excluded entirely.',
  '',
  '## Products',
  '',
  ...products.map((p) => `- [${p.title}](${SITE}/product/${p.slug})`),
  '',
  '## Optional',
  '',
  `- [llms.txt](${SITE}/llms.txt)`,
  `- [robots.txt](${SITE}/robots.txt)`,
  `- [sitemap.xml](${SITE}/sitemap.xml)`,
  '',
]
writeFileSync(join(WEB, 'public', 'llms.txt'), lines.join('\n'), 'utf8')

// ------------------------------------------------------------- .md twins (FR-5..FR-10)
// page.html.md, written by the same source of truth as the HTML build,
// never authored separately.
const md = (p) => {
  const price = p.price.amountMinor !== null ? `${(p.price.amountMinor / 100).toFixed(2)} ${p.price.currency}` : 'Unknown — not in feed'
  const shipping = p.shippingMinor !== null ? `${(p.shippingMinor / 100).toFixed(2)} ${p.shippingCurrency}` : 'Unknown — not in feed'
  return [
    `# ${p.title}`,
    '',
    `> ${p.categoryPath ?? 'Uncategorised'}`,
    '',
    `- Price: ${price}`,
    `- Shipping: ${shipping}`,
    `- Duty / customs: Unknown — no tariff data for this country + category`,
    `- VAT / sales tax: Unknown — no rate table for this destination`,
    `- Estimated total: Cannot be computed — some components are unknown`,
    `- Network: ${p.networkId}`,
    '',
    p.monetisable
      ? `[View on merchant site](${p.detailUrl})`
      : `[View on merchant site (non-affiliate)](${p.detailUrl})`,
    '',
    '> Affiliate links earn a commission at no extra cost to you. This page is a static artifact generated from the same source as the HTML page.',
    '',
  ].join('\n')
}

for (const p of products) {
  const dest = join(WEB, 'public', 'product', `${p.slug}.html.md`)
  mkdirSync(join(WEB, 'public', 'product'), { recursive: true })
  writeFileSync(dest, md(p), 'utf8')
}

// Home-page twin — advertised by the Link header in app/layout.tsx.
writeFileSync(
  join(WEB, 'public', 'index.html.md'),
  [
    '# Affiliate Price Intelligence',
    '',
    '> Honest price history and landed-cost answers from the affiliate feed. Safety-critical categories are excluded entirely.',
    '',
    '## Catalog',
    '',
    ...products.map((p) => `- [${p.title}](${SITE}/product/${p.slug})`),
    '',
  ].join('\n'),
  'utf8',
)

// ------------------------------------------------------------- robots.txt (FR-15..18)
const robots = [
  'User-agent: *',
  'Allow: /',
  '',
  '# OAI-SearchBot explicitly allowed — blocking it removes the site from ChatGPT search results.',
  'User-agent: OAI-SearchBot',
  'Allow: /',
  '',
  '# GPTBot governs TRAINING use, not search visibility. Explicit, documented choice:',
  '# we allow it because the site exists to be read and carry our affiliate link.',
  'User-agent: GPTBot',
  'Allow: /',
  '',
  '# Perplexity',
  'User-agent: PerplexityBot',
  'Allow: /',
  '',
  '# Google AI agents: decision is to allow search, decline bulk training scraping.',
  'User-agent: Google-Extended',
  'Disallow: /',
  '',
  `Sitemap: ${SITE}/sitemap.xml`,
  `# Note: robots.txt changes documented by OpenAI take ~24h to take effect.`,
  '',
]
writeFileSync(join(WEB, 'public', 'robots.txt'), robots.join('\n'), 'utf8')

// ------------------------------------------------------------- sitemap.xml
const urls = [
  { loc: '/', priority: '1.0' },
  { loc: '/catalog', priority: '0.8' },
  ...products.map((p) => ({ loc: `/product/${p.slug}`, priority: '0.6' })),
]
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.flatMap((u) => [
    '  <url>',
    `    <loc>${SITE}${u.loc}</loc>`,
    '    <changefreq>hourly</changefreq>',
    `    <priority>${u.priority}</priority>`,
    '  </url>',
  ]),
  '</urlset>',
  '',
]
writeFileSync(join(WEB, 'public', 'sitemap.xml'), sitemap.join('\n'), 'utf8')

console.log(`[artifacts] wrote llms.txt, robots.txt, sitemap.xml (${urls.length} urls)`)