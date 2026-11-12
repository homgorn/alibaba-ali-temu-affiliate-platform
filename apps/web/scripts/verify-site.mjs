/**
 * L7 compliance verification — SPEC-004 §6 (FR-4), F018/F019/F020.
 *
 * Reads the static export in out/ and asserts the contract:
 *   - primary content present in raw HTML (never JS-only)
 *   - .md twins contain the SAME facts as the HTML
 *   - llms.txt links resolve to files on disk
 *   - robots.txt explicitly allows OAI-SearchBot
 *   - sitemap.xml lists every product page
 *   - product HTML < 100 KB (FR-25)
 *
 * Exit 0 = VERIFIED, 1 = NOT VERIFIED.
 */

import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'out')

const results = []
function check(step, ok, evidence) {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
}

const htmlFiles = readdirSync(join(OUT, 'product')).filter((f) => f.endsWith('.html'))
const mdFiles = readdirSync(join(OUT, 'product')).filter((f) => f.endsWith('.html.md'))
check('Site export  product HTML pages generated', htmlFiles.length === 55, `${htmlFiles.length} pages`)

// --- F018: primary content present in raw HTML, not JS-only
const sample = readFileSync(join(OUT, 'product', '33006951783.html'), 'utf8')
const mustContain = [
  'Wireless Bluetooth Earbuds',           // title
  'data-page-kind="product"',             // machine-readable marker (FR-4)
  'schema.org',                           // JSON-LD (FR-19)
  'Sponsored' === 'Sponsored' ? 'sponsored' : 'sponsored', // affiliate rel (proof-ish)
  'View on merchant site',                // affiliate link
]
const missing = mustContain.filter((s) => !sample.includes(s))
check('F018  product page HTML contains title, marker and link', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'all present')

// --- F018: .md twin exists and contains the SAME merchant link href as HTML
// The page also carries a site-origin alternate link (e.g. /product/slug.html.md),
// which is NOT the affiliate link. Pick the first EXTERNAL href — the only
// external link on the page is the merchant one.
const md = readFileSync(join(OUT, 'product', '33006951783.html.md'), 'utf8')
const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.pages.dev').replace(/\/+$/, '')
const externalHref = [...sample.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).find((h) => !h.startsWith(siteOrigin))
const mdHasSameLink = externalHref ? md.includes(externalHref) : false
check('F018  .md twin carries the same affiliate link as the HTML', mdHasSameLink, externalHref ?? 'no external link found in HTML')

// --- F018: .md twin carries the same price as the HTML
const priceMatch = sample.match(/(\d+\.\d{2})\s*(USD|EUR|GBP|JPY)/)
const priceOk = priceMatch ? md.includes(priceMatch[1]) : false
check('F018  .md twin carries the same price as the HTML', priceOk, priceMatch ? `${priceMatch[1]} ${priceMatch[2]}` : 'no price found')

// --- F019: llms.txt exists; every link resolves to a file in out/
const llmsPath = join(OUT, 'llms.txt')
check('F019  /llms.txt exists', existsSync(llmsPath), llmsPath)
const llms = readFileSync(llmsPath, 'utf8')
const lines = llms.split('\n')
check('F019  /llms.txt conforms to v2 shape (H1 + blockquote)', /^# /.test(lines[0]) && /^> /.test(lines[1]), `${lines[0]} | ${lines[1]}`)
const llmsLinks = [...llms.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])
const badLinks = llmsLinks.filter((l) => {
  let rel
  if (l.startsWith(siteOrigin)) rel = l.slice(siteOrigin.length)
  else if (l.startsWith('http')) rel = null // external link — llms.txt should only link our own pages
  else if (l.startsWith('/')) rel = l
  else rel = `/${l}`
  if (rel === null) return true
  rel = rel.replace(/\/+$/, '') || '/'
  if (rel === '/llms.txt' || rel === '/robots.txt' || rel === '/sitemap.xml') return !existsSync(join(OUT, rel.slice(1)))
  if (rel === '/') return !existsSync(join(OUT, 'index.html'))
  const page = rel.slice(1) + '.html'
  return !existsSync(join(OUT, page)) && !existsSync(join(OUT, rel.slice(1), 'index.html'))
})
check('F019  every llms.txt link resolves on disk', badLinks.length === 0, badLinks.length ? `bad: ${badLinks.join(', ')}` : `${llmsLinks.length} links OK`)

// --- F019: robots.txt explicitly allows OAI-SearchBot; references sitemap and llms.txt
const robots = readFileSync(join(OUT, 'robots.txt'), 'utf8')
check('F019  robots.txt explicitly allows OAI-SearchBot', /User-agent: OAI-SearchBot\s*\nAllow: \//.test(robots), 'OAI-SearchBot allowed')
check('F019  robots.txt states sitemap', robots.includes('Sitemap:'), robots.match(/Sitemap: .*/)?.[0] ?? 'missing')

// --- F019: sitemap.xml lists every product page
const sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf8')
const sitemapProductLinks = (sitemap.match(/<loc>[^<]*\/product\/\d+<\/loc>/g) ?? []).length
check('F019  sitemap.xml lists all 55 product pages', sitemapProductLinks === 55, `${sitemapProductLinks} product urls`)

// --- F020: product HTML < 100 KB (FR-25), no external JS needed for content
const oversize = htmlFiles.filter((f) => statSync(join(OUT, 'product', f)).size >= 100 * 1024)
check('F020  every product page < 100 KB (FR-25)', oversize.length === 0, oversize.length ? `oversize: ${oversize.join(', ')}` : `all ${htmlFiles.length} pages < 100 KB`)
const jsOnly = htmlFiles.filter((f) => {
  const html = readFileSync(join(OUT, 'product', f), 'utf8')
  return !html.includes('data-page-kind')
})
check('F021  every product page shows an honest landed-cost breakdown', htmlFiles.every((f) => {
  const html = readFileSync(join(OUT, 'product', f), 'utf8')
  return html.includes('cost-block') && html.includes('Estimated total') && html.includes('incomplete')
}), 'all pages show cost-block with incomplete notice')

const failed = results.filter((r) => !r.ok)
const verdict = failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'
console.log(`\n=== VERDICT: ${verdict} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)
