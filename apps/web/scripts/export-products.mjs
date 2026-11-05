/**
 * Export build-time product JSON from the database.
 *
 * Runs the real ingestion pipeline (migrate + seed + ingest of the site feed)
 * against a scratch SQLite database, then reads the products table and emits
 * apps/web/data/products.json — the source of truth for the static build.
 *
 * The site build (SPEC-004 FR-3) never fetches product data from the browser.
 *
 * Usage:  node apps/web/scripts/export-products.mjs
 * Feed:   tests/fixtures/products.csv by default; override with SITE_FEED=path
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

const ROOT = join(import.meta.dirname, '..', '..', '..')
const OUT_DIR = join(import.meta.dirname, '..', 'data')
const OUT = join(OUT_DIR, 'products.json')
const FEED = process.env.SITE_FEED ?? join(ROOT, 'tests/fixtures/products.csv')
const safetyEnv = process.env.SAFETY_EXCLUDED_CATEGORIES ?? 'battery,batteries,charger,chargers,power bank,powerbank,lithium,ppe,gloves,helmet,car seat,stroller,baby,infant,toddler,crib,child safety'

function sh(cmd, args, env, stdio = 'inherit') {
  execFileSync(cmd, args, { env, stdio })
}

function clean(s) {
  return String(s ?? '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .trim()
}

// 1. scratch DB, migrated + seeded + fed exactly as the documented CLI does
const scratch = mkdtempSync(join(tmpdir(), 'site-data-'))
const dbPath = join(scratch, 'site.db')
const env = { ...process.env, DATABASE_URL: `file:${dbPath}`, SAFETY_EXCLUDED_CATEGORIES: safetyEnv }
try {
  sh(process.execPath, ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli/migrate.ts')], env)
  sh(process.execPath, ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli/seed.ts')], env)
  sh(process.execPath, ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli/ingest.ts'), FEED, '--network', 'aliexpress', '--observed-at', '2026-11-04T00:00:00.000Z'], env)
} catch (err) {
  console.error('[site-data] CLI failed:', clean(String(err?.message ?? err)).split('\n')[0])
  process.exit(1)
}

// 2. read back the rows the build needs
const db = new DatabaseSync(dbPath)
const rows = db.prepare(`
  SELECT p.external_product_id, p.title, p.detail_url, p.category_path,
         p.monetisable, p.safety_excluded, p.image_url,
         o.sale_price_minor, o.currency
  FROM product p
  LEFT JOIN (
    SELECT product_id, destination_country, MAX(observed_at) AS max_at
    FROM price_observation GROUP BY product_id, destination_country
  ) latest ON latest.product_id = p.product_id
  LEFT JOIN price_observation o
    ON o.product_id = latest.product_id
   AND o.destination_country = latest.destination_country
   AND o.observed_at = latest.max_at
  WHERE p.safety_excluded = 0
  ORDER BY p.external_product_id
`).all()
db.close()

const products = rows.map((row) => ({
  slug: row.external_product_id,
  title: row.title,
  networkId: 'aliexpress',
  detailUrl: row.detail_url,
  categoryPath: row.category_path ?? null,
  imageUrl: row.image_url ?? null,
  monetisable: row.monetisable === 1 || row.monetisable === true,
  price: {
    currency: row.currency ?? 'USD',
    amountMinor: row.sale_price_minor ?? null,
  },
}))

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify({ products }, null, 2), 'utf8')
console.log(`[site-data] wrote ${products.length} products -> ${OUT}`)
rmSync(scratch, { recursive: true, force: true })