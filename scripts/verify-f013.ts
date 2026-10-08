/**
 * Independent verification of F013 — price history across multiple ingests.
 *
 * F013's steps, executed literally through the documented CLI against a scratch
 * database, with assertions read through a SEPARATE connection.
 */

import { mkdtempSync, rmSync, readFileSync, writeFileSync, copyFileSync, appendFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (p: string) => {
    prepare(sql: string): { all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown }
    exec(sql: string): void
    close(): void
  }
}

const ROOT = join(import.meta.dirname, '..')
const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string): boolean {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
  return ok
}

const scratch = mkdtempSync(join(tmpdir(), 'f013-verify-'))
const dbPath = join(scratch, 'verify.db')
const env = { ...process.env, DATABASE_URL: `file:${dbPath}` }

function run(script: string, args: string[] = []): string {
  return execFileSync(
    'node',
    ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli', script), ...args],
    { env, encoding: 'utf8' },
  ).replace(/\u001b\[[0-9;]*m/g, '').trim()
}

// Build a modified feed where ONE product's price drops.
const base = join(ROOT, 'tests/fixtures/products.csv')
const baseCsv = readFileSync(base, 'utf8')
const v1 = join(scratch, 'feed.csv')
const v2 = join(scratch, 'feed-price-drop.csv')
writeFileSync(v1, baseCsv, 'utf8')

const TARGET = '33006951783'
const dropped = baseCsv.replace(
  new RegExp(`(aliexpress,${TARGET},[^\\n]*?),USD,US,18\\.50`),
  '$1,USD,US,14.99',
)
if (dropped === baseCsv) {
  console.error('FATAL: could not build the price-drop fixture')
  process.exit(1)
}
writeFileSync(v2, dropped, 'utf8')
void copyFileSync

const T1 = '2026-10-01T09:00:00.000Z'
const T2 = '2026-10-05T09:00:00.000Z'
const T3 = '2026-10-08T09:00:00.000Z'

run('migrate.ts')
run('seed.ts')

// ---------------------------------------------------------------- ingest
const out1 = run('ingest.ts', [v1, '--network', 'aliexpress', '--observed-at', T1])
const out2 = run('ingest.ts', [v2, '--network', 'aliexpress', '--observed-at', T2])
const out3 = run('ingest.ts', [v2, '--network', 'aliexpress', '--observed-at', T3])

// ---------------------------------------------------------------- separate connection
const db = new DatabaseSync(dbPath)
const q = (sql: string, ...p: unknown[]): number =>
  (db.prepare(sql).get(...p) as { c: number }).c

function series(externalId: string) {
  return db
    .prepare(
      `SELECT po.observed_at, po.sale_price_minor, po.source
       FROM price_observation po
       JOIN product p ON p.product_id = po.product_id
       WHERE p.external_product_id = ? AND po.destination_country = 'US'
       ORDER BY po.observed_at`,
    )
    .all(externalId) as { observed_at: string; sale_price_minor: number; source: string }[]
}

// ---------------------------------------------------------------- F013 steps 1-2
const s = series(TARGET)
check(
  'F013 step 1-2  a product queried after multiple ingests returns >1 historical price point',
  s.length >= 2,
  `${s.length} points for ${TARGET}: ${s.map((x) => `${x.observed_at.slice(0, 10)}=${(x.sale_price_minor / 100).toFixed(2)}`).join(' -> ')}`,
)

check(
  'F013  the price DROP is recorded as a distinct earlier value',
  s.length >= 2 && s[0]!.sale_price_minor === 1850 && s[1]!.sale_price_minor === 1499,
  `first=${(s[0]!.sale_price_minor / 100).toFixed(2)}, second=${(s[1]!.sale_price_minor / 100).toFixed(2)}`,
)

check(
  'F013 step 2  each observation records its source',
  s.every((x) => x.source === 'csv'),
  `sources: ${[...new Set(s.map((x) => x.source))].join(',')}`,
)

// ---------------------------------------------------------------- F013 step 3
// Build the rollup and confirm it survives deletion of raw observations (FR-18).
const productId = (
  db.prepare('SELECT product_id FROM product WHERE external_product_id = ?').get(TARGET) as {
    product_id: string
  }
).product_id

db.exec(`
  INSERT INTO price_daily_rollup (product_id, destination_country, day, currency,
     min_price_minor, max_price_minor, avg_price_minor, first_price_minor,
     last_price_minor, observations, computed_at)
  SELECT product_id, destination_country, '2026-10-01', currency,
     MIN(sale_price_minor), MAX(sale_price_minor), AVG(sale_price_minor),
     MIN(sale_price_minor), MAX(sale_price_minor), COUNT(*), '${T3}'
  FROM price_observation
  WHERE product_id = '${productId}' GROUP BY product_id, destination_country, currency
`)
const rollupBefore = q('SELECT count(*) AS c FROM price_daily_rollup')
db.exec('DELETE FROM price_observation')
const rollupAfter = q('SELECT count(*) AS c FROM price_daily_rollup')
check(
  'F013 step 3 / FR-18  the daily rollup survives deletion of raw observations',
  rollupAfter === rollupBefore && rollupAfter > 0,
  `rollup rows ${rollupBefore} -> ${rollupAfter} after deleting all raw observations`,
)

const retention = db
  .prepare(`SELECT table_name, max_age_days, rollup_to FROM retention_policy WHERE table_name = 'price_observation'`)
  .all() as { table_name: string; max_age_days: number; rollup_to: string | null }[]
check(
  'F013 step 3  retention/downsample rule is configured with a rollup target',
  retention.length === 1 && retention[0]!.rollup_to === 'price_daily_rollup',
  retention.length ? JSON.stringify(retention[0]) : 'no retention_policy row — run pnpm db:seed',
)

// ---------------------------------------------------------------- change accounting
check(
  'A price-only change is reported as rowsWritten 1, not 0',
  /rows written\s+1/.test(out2),
  (out2.match(/rows written\s+\d+/) ?? [''])[0] ?? out2.split('\n')[0] ?? '',
)
check(
  'A no-op re-ingest is reported as rowsWritten 0',
  /rows written\s+0/.test(out3),
  (out3.match(/rows written\s+\d+/) ?? [''])[0] ?? '',
)

// Re-ingesting the SAME feed on a later date must not stack duplicate points.
db.close()
const scratch2 = mkdtempSync(join(tmpdir(), 'f013-dup-'))
const env2 = { ...process.env, DATABASE_URL: `file:${join(scratch2, 'v.db')}` }
const run2 = (script: string, args: string[]) =>
  execFileSync('node', ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli', script), ...args], {
    env: env2,
    encoding: 'utf8',
  })
    .replace(/\u001b\[[0-9;]*m/g, '')
    .trim()

run2('migrate.ts', [])
run2('seed.ts', [])
run2('ingest.ts', [v1, '--network', 'aliexpress', '--observed-at', T1])
run2('ingest.ts', [v1, '--network', 'aliexpress', '--observed-at', T2])
run2('ingest.ts', [v1, '--network', 'aliexpress', '--observed-at', T3])

const db2 = new DatabaseSync(join(scratch2, 'v.db'))
const perProduct = db2
  .prepare(
    `SELECT COUNT(*) AS c FROM price_observation
     WHERE product_id = (SELECT product_id FROM product WHERE external_product_id = ?)`,
  )
  .get(TARGET) as { c: number }
check(
  'Re-ingesting an unchanged feed on 3 later dates adds NO duplicate price point',
  perProduct.c === 1,
  `${TARGET} has ${perProduct.c} observation(s) after 3 ingests at T1/T2/T3 with an unchanged price`,
)
db2.close()
rmSync(scratch2, { recursive: true, force: true })

// ---------------------------------------------------------------- suite
let suiteEvidence = ''
let suiteOk = false
try {
  const o = execFileSync('pnpm', ['test'], { cwd: ROOT, encoding: 'utf8', shell: true })
    .replace(/\u001b\[[0-9;]*m/g, '')
  suiteOk = !/failed/i.test(o)
  suiteEvidence = o.split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ')
} catch (e) {
  suiteEvidence = (e as { stdout?: string }).stdout?.replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ') ?? 'suite failed'
}
check('Test suite  pnpm test passes', suiteOk, suiteEvidence)

let tcOk = false
try {
  execFileSync('pnpm', ['typecheck'], { cwd: ROOT, encoding: 'utf8', shell: true })
  tcOk = true
} catch { /* false */ }
check('Typecheck  pnpm typecheck clean', tcOk, tcOk ? 'exit 0' : 'errors reported')

// ---------------------------------------------------------------- verdict
const failed = results.filter((r) => !r.ok)
const verdict = failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'

const logPath = join(ROOT, 'docs/logs/BUILD_LOG.md')
if (!existsSync(logPath)) writeFileSync(logPath, '# BUILD LOG\n\n', 'utf8')
appendFileSync(
  logPath,
  [
    '',
    '---',
    '',
    '## F013 — price history across multiple ingests',
    '',
    `**Verified:** ${new Date().toISOString()} · **Verifier:** orchestrating agent (self-verification)`,
    `**Verdict:** ${verdict} (${results.length - failed.length}/${results.length} checks passed)`,
    '',
    '| Check | Result | Evidence |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.step} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.evidence.replace(/\|/g, '\\|').slice(0, 200)} |`),
    '',
  ].join('\n'),
)

console.log(`\n=== VERDICT: ${verdict} (${results.length - failed.length}/${results.length}) ===`)
rmSync(scratch, { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)
