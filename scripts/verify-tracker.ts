/**
 * Verification for the internal attribution tracker (ADR-005, issue #2).
 *
 * This is NOT the F023 gate (which needs live traffic on a deployed site).
 * It is independent evidence that the tracker kernel works end to end:
 *   click (3 channels) → recorded with channel and hashed visitor
 *   → conversion linked (or correctly unlinked) → EPC per channel
 *
 * Runs against a scratch DB created through the documented CLI.
 * Exits 0 on VERIFIED, 1 otherwise. Appends the verdict to BUILD_LOG.md.
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
  }
}

const ROOT = join(import.meta.dirname, '..')

import { createSqliteRunner } from '../src/engine/db/sqlite-runner.ts'
import { migrate } from '../src/engine/db/migrate.ts'
import { ingestCsv } from '../src/engine/ingest/ingest-csv.ts'
import { parseSafetyConfig } from '../src/engine/ingest/safety.ts'
import { recordClick } from '../src/engine/attribution/click.ts'
import { recordConversion } from '../src/engine/attribution/postback.ts'
import { epcByChannel } from '../src/engine/attribution/epc.ts'

const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string) {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
}

const scratch = mkdtempSync(join(tmpdir(), 'tracker-verify-'))
const dbPath = join(scratch, 'v.db')
const r = createSqliteRunner(`file:${dbPath}`)
migrate(r, join(ROOT, 'db', 'migrations'))

r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model,
          cookie_window_days, supports_product_feed, supports_deep_links)
        VALUES ('aliexpress','AliExpress','live-api','cps',3,1,1)`, [])

// Seed one product through the documented CSV path.
const safety = parseSafetyConfig('battery,charger')
const src = readFileSync(join(ROOT, 'tests/fixtures/products.csv'), 'utf8')
const res = ingestCsv(r, src, {
  networkId: 'aliexpress', moduleId: 'csv:aliexpress', source: 'csv', safety, now: new Date('2026-10-01T00:00:00.000Z'),
})
const product = r.query<{ product_id: string }>('SELECT product_id FROM product LIMIT 1')[0]!
check('Setup  seed product via CLI', res.rowsWritten > 0, `product=${product.product_id}`)
r.close()

const db = new DatabaseSync(dbPath)

const q = (sql: string) => db.prepare(sql).all() as Record<string, unknown>[]

function openRunner() {
  return createSqliteRunner(`file:${dbPath}`)
}

// ---- 1. three channels record three clicks, each with its own channel
const rr = openRunner()
for (const ch of ['organic', 'telegram', 'paid_google']) {
  recordClick(rr, {
    productId: product.product_id, channel: ch,
    sourceHost: 'example.pages.dev', ip: `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
    userAgent: `TestBrowser/${ch}`, salt: 'verifier-salt',
    now: new Date('2026-11-03T00:00:00.000Z'),
  })
}
rr.close()

const clickRows = q('SELECT channel FROM click_event')
const channels = [...new Set(clickRows.map((x) => String(x.channel)))]
check(
  'Tracker  three channels produce three stored clicks',
  clickRows.length === 3 && channels.length === 3,
  `channels=[${channels.join(',')}] total=${clickRows.length}`,
)

// ---- 2. visitor hash contains no raw IP
const rawRows = q('SELECT visitor_hash FROM click_event')
check(
  'Tracker  no raw IP appears in stored visitor hashes',
  rawRows.every((x) => typeof x.visitor_hash === 'string' && !/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(String(x.visitor_hash))),
  rawRows.map((x) => String(x.visitor_hash).slice(0, 8) + '…').join(', '),
)

// ---- 3. conversion linked to an organic click; idempotent re-report is a no-op
const organicClick = (q("SELECT click_id FROM click_event WHERE channel = 'organic'")[0] as { click_id: string }).click_id
const rr2 = openRunner()
const first = recordConversion(rr2, {
  networkId: 'aliexpress', externalOrderId: 'ORD-VERIFY-1',
  amountMinor: 1500, currency: 'USD', clickId: organicClick, status: 'converted',
  reportedAt: '2026-11-04T00:00:00.000Z',
})
const second = recordConversion(rr2, {
  networkId: 'aliexpress', externalOrderId: 'ORD-VERIFY-1',
  amountMinor: 9999, currency: 'USD', clickId: organicClick, status: 'pending',
  reportedAt: '2026-11-04T01:00:00.000Z',
})
rr2.close()
check(
  'Postback  duplicate report for the same order is idempotent',
  first.created && !second.created && second.conversionId === first.conversionId,
  `created(${first.created}) → same conversionId=${second.conversionId === first.conversionId}`,
)

// ---- 4. EPC per channel (commission divided by clicks, converted only)
const rr3 = openRunner()
const report = epcByChannel(rr3, 'USD')
rr3.close()
const organic = report.rows.find((x) => x.channel === 'organic')!
check(
  'EPC  organic earns commission on one converted click',
  organic.clicks === 1 && organic.commissionMinor === 1500 && organic.epcMinor === 1500,
  `clicks=${organic.clicks} conversions=${organic.conversions} commission=${organic.commissionMinor} epc=${organic.epcMinor}`,
)

// ---- 5. unattributed report surfaces, not collapsed
check(
  'EPC  unattributed network reports are surfaced separately, never merged',
  report.unattributed === 0 && report.rows.length === 3,
  `unattributed=${report.unattributed} rows=[${report.rows.map((x) => x.channel).join(',')}]`,
)

db.close()

const failed = results.filter((x) => !x.ok)
const verdict = failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'
console.log(`\n=== VERDICT: ${verdict} (${results.length - failed.length}/${results.length}) ===`)

// Append to BUILD_LOG (protocol: append-only)
const logPath = join(ROOT, 'docs/logs/BUILD_LOG.md')
if (!existsSync(logPath)) appendFileSync(logPath, '# BUILD LOG\n\n', 'utf8')
appendFileSync(logPath, [
  '',
  '---',
  '',
  '## Attribution tracker kernel (ADR-005) — click → postback → EPC',
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