/**
 * Independent verification of F012 — CSV ingestion end to end.
 *
 * Executes F012's steps LITERALLY, from feature_list.json, in a scratch
 * database, using the documented CLI commands. Uses a separate connection for
 * assertions so a bug in the ingest code cannot make the result look correct.
 */

import { mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
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

const scratch = mkdtempSync(join(tmpdir(), 'f012-verify-'))
const dbPath = join(scratch, 'verify.db')
const env = { ...process.env, DATABASE_URL: `file:${dbPath}` }

function run(script: string, args: string[] = []): string {
  return execFileSync(
    'node',
    ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli', script), ...args],
    { env, encoding: 'utf8' },
  )
    .replace(/\u001b\[[0-9;]*m/g, '')
    .trim()
}

/**
 * Fixed observation instant. Both the first and second ingest use it, which is
 * what "re-ingesting identical input" means: same input => same observation
 * time => no new price point. The CLI derives this from file mtime by default;
 * the flag makes the test deterministic regardless of filesystem timestamps.
 */
const T = '2026-10-08T12:00:00.000Z'

const FIXTURE = join(ROOT, 'tests/fixtures/products.csv')

// ---------------------------------------------------------------- setup
run('migrate.ts')
run('seed.ts')

// ---------------------------------------------------------------- F012 step 2
let out = ''
let ok = true
try {
  out = run('ingest.ts', [FIXTURE, '--network', 'aliexpress', '--observed-at', T])
} catch (e) {
  ok = false
  out = (e as { stderr?: string }).stderr ?? String(e)
}
check('F012 step 2  the documented command completes without error', ok && out.includes('ingested'), out.split('\n')[0] ?? out)

// It must REPORT a count (the step says "prints a count of rows ingested").
const printedCount = /rows read\s+(\d+)/.test(out)
check('F012 step 2  the command prints a rows-ingested count', printedCount, printedCount ? (out.match(/rows read\s+\d+/) ?? [''])[0] : 'no count printed')

// ---------------------------------------------------------------- independent connection
const db = new DatabaseSync(dbPath)
const q = (sql: string, ...p: unknown[]): number =>
  (db.prepare(sql).get(...p) as { c: number }).c

// ---------------------------------------------------------------- F012 step 3
const csvLines = readFileSync(FIXTURE, 'utf8').trim().split('\n')
const dataRows = csvLines.length - 1
const readCount = Number((out.match(/rows read\s+(\d+)/) ?? [])[1] ?? 0)
check(
  'F012 step 3  rows read equals the fixture row count',
  readCount === dataRows,
  `fixture data rows=${dataRows}, command reported=${readCount}`,
)

const products = q('SELECT count(*) AS c FROM product')
const excluded = q('SELECT count(*) AS c FROM safety_exclusion')
check(
  'F012 step 3  every row is either stored or safety-excluded — none lost',
  products + excluded === dataRows,
  `products=${products} + safety_excluded=${excluded} = ${products + excluded} vs fixture ${dataRows}`,
)
check(
  'F012 step 3  a product table and a price-history table hold data',
  products > 0 && q('SELECT count(*) AS c FROM price_observation') > 0,
  `product=${products}, price_observation=${q('SELECT count(*) AS c FROM price_observation')}`,
)

// ---------------------------------------------------------------- F012 step 4
const beforeCount = products
const beforeObs = q('SELECT count(*) AS c FROM price_observation')
const beforeExcl = excluded
const beforeRows = q('SELECT count(*) AS c FROM ingestion_run')

out = run('ingest.ts', [FIXTURE, '--network', 'aliexpress', '--observed-at', T])
const afterCount = q('SELECT count(*) AS c FROM product')
const afterObs = q('SELECT count(*) AS c FROM price_observation')
const afterExcl = q('SELECT count(*) AS c FROM safety_exclusion')

check(
  'F012 step 4  second run applies nothing — idempotent, no data loss',
  afterCount === beforeCount && afterObs === beforeObs && afterExcl === beforeExcl,
  `products ${beforeCount}->${afterCount}, observations ${beforeObs}->${afterObs}, exclusions ${beforeExcl}->${afterExcl}`,
)
check(
  'F012 step 4  the second run still records its own ingestion_run (audit, not dedup)',
  q('SELECT count(*) AS c FROM ingestion_run') === beforeRows + 1,
  `ingestion_run ${beforeRows} -> ${q('SELECT count(*) AS c FROM ingestion_run')}`,
)
check(
  'F012 step 4  the command reports 0 written and N unchanged',
  /rows written\s+0/.test(out) && /rows unchanged\s+\d+/.test(out),
  (out.match(/rows (?:read|written|unchanged)\s+\d+/g) ?? []).join(' | '),
)

// ---------------------------------------------------------------- F012 step 5
const targetId = '33006951783'
const modified = join(scratch, 'modified.csv')
writeFileSync(
  modified,
  readFileSync(FIXTURE, 'utf8').replace(
    'Wireless Bluetooth Earbuds Noise Cancelling Sport Headphones',
    'Wireless Bluetooth Earbuds PRO Noise Cancelling',
  ),
  'utf8',
)

out = run('ingest.ts', [modified, '--network', 'aliexpress', '--observed-at', T])
const changedRow = db
  .prepare('SELECT title FROM product WHERE external_product_id = ?')
  .get(targetId) as { title: string }
const total = q('SELECT count(*) AS c FROM product')
const obsAfterChange = q('SELECT count(*) AS c FROM price_observation')

check(
  'F012 step 5  modifying one field changes exactly that row and nothing else',
  total === beforeCount &&
    changedRow.title.includes('PRO') &&
    /rows written\s+1/.test(out) &&
    obsAfterChange === beforeObs,
  `total=${total} (was ${beforeCount}), title="${changedRow.title}", ` +
    `${(out.match(/rows written\s+\d+/) ?? [''])[0]}, observations ${beforeObs}->${obsAfterChange} ` +
    `(title-only change must not add a price point)`,
)

// ---------------------------------------------------------------- honest-value guarantees
const incomplete = q('SELECT count(*) AS c FROM price_observation WHERE is_complete = 0')
const complete = q('SELECT count(*) AS c FROM price_observation WHERE is_complete = 1')
const zeroShipment = q('SELECT count(*) AS c FROM price_observation WHERE shipping_minor = 0 AND is_complete = 0')
check(
  'SPEC-003 FR-9  unknown shipping stored as NULL, never as 0',
  incomplete > 0 && complete > 0 && zeroShipment === 0,
  `incomplete=${incomplete}, complete=${complete}, unknown-but-stored-as-0=${zeroShipment}`,
)

const excludedInCatalogue = db
  .prepare(
    `SELECT count(*) AS c FROM product p
     WHERE EXISTS (SELECT 1 FROM safety_exclusion s WHERE s.title = p.title)`,
  )
  .get() as { c: number }
check(
  'SPEC-001 FR-20  no safety-excluded product is in the catalogue',
  excludedInCatalogue.c === 0,
  `${excludedInCatalogue.c} excluded titles found in product`,
)

const floatMoney = (() => {
  let bad = 0
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all() as { name: string }[]
  for (const t of tables) {
    for (const c of db.prepare(`PRAGMA table_info(${t.name})`).all() as { name: string; type: string }[]) {
      if (/minor|amount/i.test(c.name) && c.type !== 'INTEGER') bad++
    }
  }
  return bad
})()
check('SPEC-003 FR-3  money is still integer-only after ingest', floatMoney === 0, `${floatMoney} non-integer money columns`)

const orphans = q('SELECT count(*) AS c FROM product WHERE source_run_id IS NULL')
check('SPEC-003 FR-19  every product is traceable to a run', orphans === 0, `${orphans} products without source_run_id`)

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
db.close()
const failed = results.filter((r) => !r.ok)
const verdict = failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'

const logPath = join(ROOT, 'docs/logs/BUILD_LOG.md')
if (!existsSync(logPath)) {
  writeFileSync(logPath, '# BUILD LOG\n\nAppend-only build/verification state.\n\n', 'utf8')
}
appendFileSync(
  logPath,
  [
    '',
    '---',
    '',
    '## F012 — CSV feed ingested end to end',
    '',
    `**Verified:** ${new Date().toISOString()} · **Verifier:** orchestrating agent (self-verification)`,
    `**Verdict:** ${verdict} (${results.length - failed.length}/${results.length} checks passed)`,
    '',
    '| Check | Result | Evidence |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.step} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.evidence.replace(/\|/g, '\\|').slice(0, 200)} |`),
    '',
    '**Method note:** assertions run through a SEPARATE database connection and the',
    'documented CLI, not the ingest code path under test.',
    '',
  ].join('\n'),
)

console.log(`\n=== VERDICT: ${verdict} (${results.length - failed.length}/${results.length}) ===`)
rmSync(scratch, { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)
