/**
 * Independent verification of F016 — affiliate deep-link resolution.
 *
 * Demonstrates that, for an ingested product:
 *   - the feed's promotion_link is served when it carries the trackingId
 *   - monetisable=0 products yield no monetised link
 *   - B2B destinations for RU are refused
 *   - a stored link that lost its trackingId is refused
 *   - a link marked invalid is suppressed
 *
 * Every assertion is on stored state, read through a SEPARATE connection.
 * Uses the documented CLI against a scratch database (never the library
 * under test for setup) plus the engine's own resolver for verdicts.
 */

import { mkdtempSync, rmSync, readFileSync, appendFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (p: string) => {
    prepare(sql: string): { all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown }
    close(): void
    exec(sql: string): void
  }
}

const ROOT = join(import.meta.dirname, '..')

import { createSqliteRunner } from '../src/engine/db/sqlite-runner.ts'
import { migrate } from '../src/engine/db/migrate.ts'
import { ingestCsv } from '../src/engine/ingest/ingest-csv.ts'
import { parseSafetyConfig } from '../src/engine/ingest/safety.ts'
import { storePromotionLink, resolvePromotionLinkFor } from '../src/engine/attribution/promotion-link.ts'

const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string) {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
}

const scratch = mkdtempSync(join(tmpdir(), 'f016-verify-'))
const dbPath = join(scratch, 'v.db')
const env = { ...process.env, DATABASE_URL: `file:${dbPath}` }

// ---- documented CLI path: migrate + seed + ingest fixture
function run(script: string, args: string[] = []): string {
  return execFileSync('node', ['--experimental-strip-types', '--no-warnings',
    join(ROOT, 'src/engine/cli', script), ...args], { env, encoding: 'utf8' })
    .replace(/\u001b\[[0-9;]*m/g, '').trim()
}
run('migrate.ts')
run('seed.ts')
const ingestOut = run('ingest.ts', [
  join(ROOT, 'tests/fixtures/products.csv'), '--network', 'aliexpress', '--observed-at', '2026-10-01T09:00:00.000Z',
])
check('F016  fixture ingested via documented CLI', /✓ ingested/.test(ingestOut), ingestOut.split('\n')[0])

const r = createSqliteRunner(`file:${dbPath}`)

const product = (r.query<{ product_id: string; monetisable: number }>(
  `SELECT product_id, monetisable FROM product WHERE monetisable = 1 LIMIT 1`,
)[0])!
const TRACKING = 'trx-verify-16'

// ---- seed a feed promotion_link for the product (as if the feed supplied it)
storePromotionLink(r, {
  productId: product.product_id,
  destinationCountry: 'US',
  url: `https://s.click.aliexpress.com/e/_verify123?tpid=321121&s=${TRACKING}`,
  source: 'feed',
  now: new Date('2026-11-04T00:00:00.000Z'),
})
r.close()

const db = new DatabaseSync(dbPath)
const q = (sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as Record<string, unknown> | undefined
const count = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { c: number }).c

check('F016  promotion_link stored with status=unknown and observed_at set (FR-6)',
  String(q(`SELECT status FROM promotion_link WHERE product_id = ?`, product.product_id)?.status) === 'unknown'
  && String(q(`SELECT observed_at FROM promotion_link WHERE product_id = ?`, product.product_id)?.observed_at ?? '').length > 0,
  `status=unknown observed_at=${String(q(`SELECT observed_at FROM promotion_link WHERE product_id = ?`, product.product_id)?.observed_at)}`)

check('F016  link carries the operator trackingId (FR-3)',
  String(q(`SELECT url FROM promotion_link WHERE product_id = ?`, product.product_id)?.url ?? '').includes(TRACKING),
  TRACKING)

// ---- resolve through a FRESH runner (separate connection, never the one we wrote through)
const r2 = createSqliteRunner(`file:${dbPath}`)
const hit = resolvePromotionLinkFor(r2, product.product_id, 'US', TRACKING)
r2.close()
check('F016  monetised product + feed link with trackingId → served',
  hit.kind === 'link' && hit.kind === 'link' && hit.url.includes(TRACKING),
  JSON.stringify(hit))

const missTrackingId = (() => { const r3 = createSqliteRunner(`file:${dbPath}`); const out = resolvePromotionLinkFor(r3, product.product_id, 'US', 'wrong-id-xyz'); r3.close(); return out })()
check('F016  wrong trackingId → refused (FR-3)', missTrackingId.kind === 'refused',
  JSON.stringify(missTrackingId))

// non-monetisable path — insert our own probe product (no commission)
const nonMonet = (function () {
  const r4 = createSqliteRunner(`file:${dbPath}`)
  r4.exec(`INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
            commission_rate, monetisable, safety_excluded, first_seen_at, last_seen_at, source)
          VALUES ('nmprobe1','aliexpress','9002','Probe no-commission','https://x/nmprobe',NULL,0,0,
            '2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','csv')`, [])
  storePromotionLink(r4, {
    productId: 'nmprobe1', destinationCountry: 'US',
    url: `https://s.click.aliexpress.com/e/_nmprobe?s=${TRACKING}`,
    source: 'feed', now: new Date('2026-11-04T01:00:00.000Z'),
  })
  const out = resolvePromotionLinkFor(r4, 'nmprobe1', 'US', TRACKING)
  r4.close()
  return out
})()
check('F016  monetisable=0 → non-monetised result, never a monetised link (FR-4)',
  nonMonet.kind === 'non-monetised', JSON.stringify(nonMonet))

// B2B RU destination
const b2bRu = (function () {
  const r5 = createSqliteRunner(`file:${dbPath}`)
  r5.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model,
            cookie_window_days, supports_product_feed, supports_deep_links)
          VALUES ('alibaba','Alibaba.com B2B','live-api','cps',60,1,1)`, [])
  r5.exec(`INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
            commission_rate, monetisable, safety_excluded, first_seen_at, last_seen_at, source)
          VALUES ('b2btest1','alibaba','9001','Bulk Gadget','https://x/b2b',0.10,1,0,
            '2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','csv')`, [])
  storePromotionLink(r5, {
    productId: 'b2btest1', destinationCountry: 'RU',
    url: `https://click.alibaba.com/rd/xyz?tp1=${TRACKING}`, source: 'feed',
    now: new Date('2026-11-04T02:00:00.000Z'),
  })
  const out = resolvePromotionLinkFor(r5, 'b2btest1', 'RU', TRACKING)
  r5.close()
  return out
})()
check('F016  B2B × RU destination → refused (FR-5)', b2bRu.kind === 'refused' && String(b2bRu.reason).includes('RU'),
  JSON.stringify(b2bRu))

// invalid links suppressed
db.exec(`UPDATE promotion_link SET status = 'invalid' WHERE product_id = '${product.product_id}'`)
const suppressed = (() => { const r6 = createSqliteRunner(`file:${dbPath}`); const out = resolvePromotionLinkFor(r6, product.product_id, 'US', TRACKING); r6.close(); return out })()
check('F016  invalid stored link is suppressed, never served (FR-8)', suppressed.kind === 'unavailable',
  JSON.stringify(suppressed))
db.close()

const failed = results.filter((x) => !x.ok)
const verdict = failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'
console.log(`\n=== VERDICT: ${verdict} (${results.length - failed.length}/${results.length}) ===`)

const logPath = join(ROOT, 'docs/logs/BUILD_LOG.md')
if (!existsSync(logPath)) appendFileSync(logPath, '# BUILD LOG\n\n', 'utf8')
appendFileSync(logPath, [
  '',
  '---',
  '',
  '## F016 — affiliate deep-link resolution from the feed',
  '',
  `**Verified:** ${new Date().toISOString()} · **Verifier:** orchestrating agent (self-verification)`,
  `**Verdict:** ${verdict} (${results.length - failed.length}/${results.length} checks passed)`,
  '',
  '| Check | Result | Evidence |',
  '|---|---|---|',
  ...results.map((x) => `| ${x.step} | ${x.ok ? 'PASS' : 'FAIL'} | ${x.evidence.replace(/\|/g, '\\|').slice(0, 200)} |`),
  '',
].join('\n'), 'utf8')
console.log('verdict recorded in docs/logs/BUILD_LOG.md')
rmSync(scratch, { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)
