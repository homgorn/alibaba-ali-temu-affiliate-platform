/**
 * Independent verification of F011 + the SPEC-003 acceptance criteria that can
 * be checked without credentials.
 *
 * Deliberately does NOT reuse the migration runner: it opens the database
 * through a SEPARATE connection so a bug in the runner cannot make the schema
 * look correct. A self-check written with the same code path proves nothing.
 */

import { mkdtempSync, rmSync, cpSync, readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createSqliteRunner } from '../src/engine/db/sqlite-runner.ts'
import { migrate } from '../src/engine/db/migrate.ts'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (p: string) => {
    prepare(sql: string): { all(...p: unknown[]): unknown[] }
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

const scratch = mkdtempSync(join(tmpdir(), 'f011-verify-'))
const dbPath = join(scratch, 'verify.db')
const dbUrl = `file:${dbPath}`

// ---------------------------------------------------------------- AC-1
const t0 = Date.now()
const migrateOut = execFileSync(
  'node',
  ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli/migrate.ts')],
  { env: { ...process.env, DATABASE_URL: dbUrl }, encoding: 'utf8' },
)
const ms = Date.now() - t0
check(
  'AC-1  migrations on an empty DB complete under 10 s (NFR-4)',
  ms < 10_000,
  `${ms} ms | output: ${migrateOut.trim().replace(/\n/g, ' | ')}`,
)

check(
  'F011 step 2  command completes without error',
  migrateOut.includes('migrations applied'),
  `exit 0, stdout contained the success line`,
)

// Independent connection — not the runner under test.
const db = new DatabaseSync(dbPath)

const tables = (
  db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all() as { name: string }[]
).map((r) => r.name)

// ---------------------------------------------------------------- F011 step 3
const REQUIRED = [
  'network', 'category', 'product', 'price_observation', 'price_daily_rollup',
  'product_identity_match', 'promotion_link', 'safety_exclusion', 'retention_policy',
  'ingestion_run', 'module', 'dead_letter', 'request_ledger', 'ingestion_checkpoint',
  'image_fingerprint', 'title_normalised', 'product_variant_group',
  'product_variant_member', 'match_evaluation', 'click_event', 'conversion_event',
  'commission_record', 'link_validity_check',
]
const missing = REQUIRED.filter((t) => !tables.includes(t))
check(
  'F011 step 3  every SPEC-003 §6 table exists',
  missing.length === 0,
  `${tables.length} tables found; missing: ${missing.length ? missing.join(', ') : 'none'}`,
)
check(
  'F011 step 3  a product table and a price-history table exist',
  tables.includes('product') && (tables.includes('price_observation') || tables.includes('price_daily_rollup')),
  `product=${tables.includes('product')} price_observation=${tables.includes('price_observation')} price_daily_rollup=${tables.includes('price_daily_rollup')}`,
)

// ---------------------------------------------------------------- FR-3 (most important)
const moneyColumns: { table: string; name: string; type: string }[] = []
for (const t of tables) {
  for (const c of db.prepare(`PRAGMA table_info(${t})`).all() as {
    name: string
    type: string
  }[]) {
    if (/minor|amount/i.test(c.name)) moneyColumns.push({ table: t, name: c.name, type: c.type })
  }
}
const badMoney = moneyColumns.filter((c) => c.type !== 'INTEGER')
check(
  'FR-3  EVERY money column is INTEGER (minor units), never float',
  badMoney.length === 0 && moneyColumns.length > 5,
  `${moneyColumns.length} money columns inspected, ${badMoney.length} non-INTEGER` +
    (badMoney.length ? ` -> ${badMoney.map((c) => `${c.table}.${c.name}:${c.type}`).join(', ')}` : ''),
)

// ---------------------------------------------------------------- AC-3 idempotency
db.exec(
  `INSERT INTO network (network_id, display_name, source_kind, commission_model)
   VALUES ('probe','Probe','file-csv','cps')`,
)
const beforeCount = (
  db.prepare('SELECT count(*) AS c FROM network').all() as { c: number }[]
)[0]!.c

const second = execFileSync(
  'node',
  ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli/migrate.ts')],
  { env: { ...process.env, DATABASE_URL: dbUrl }, encoding: 'utf8' },
)
const afterCount = (
  db.prepare('SELECT count(*) AS c FROM network').all() as { c: number }[]
)[0]!.c

check(
  'AC-3 / NFR-5  re-running applies nothing and loses no data',
  afterCount === beforeCount && second.includes('already applied'),
  `rows before=${beforeCount} after=${afterCount}; output: ${second.trim().replace(/\n/g, ' | ')}`,
)

// ---------------------------------------------------------------- drift detection
// Calls migrate() DIRECTLY with a custom migrations directory. The CLI hardcodes
// db/migrations, so driving it through the CLI cannot test a temp copy — an
// earlier version of this script made exactly that mistake and reported a false
// PASS-by-omission. Testing the exported function is what actually exercises
// the guard.
const driftDir = join(scratch, 'migrations')
cpSync(join(ROOT, 'db', 'migrations'), driftDir, { recursive: true })

const driftRunner = createSqliteRunner(join(scratch, 'drift.db'))
migrate(driftRunner, driftDir)

// Edit an ALREADY-APPLIED migration file, then re-run.
const f1 = join(driftDir, '0001_core.sql')
writeFileSync(f1, `${readFileSync(f1, 'utf8')}\n-- edited after apply\n`, 'utf8')

let driftRefused = false
let driftMsg = ''
try {
  migrate(driftRunner, driftDir)
} catch (e) {
  driftRefused = true
  driftMsg = (e as Error).message.split('\n').slice(0, 2).join(' ')
}
driftRunner.close()
check(
  'Drift detection  editing an applied migration is REFUSED, not re-run',
  driftRefused,
  driftRefused
    ? `refused: ${driftMsg.slice(0, 150)}`
    : 'ERROR: migrate() silently accepted an edit to an applied migration',
)

const fk = db.prepare('PRAGMA foreign_key_check').all()
check('Referential integrity  zero FK violations in an empty schema', fk.length === 0, `${fk.length} violations`)

// ---------------------------------------------------------------- negative test (L0 proof)
const integPath = join(ROOT, 'tests/integration/schema.test.ts')
const integSrc = readFileSync(integPath, 'utf8')
const hasSanityGuard = /expect\(checked\)\.toBeGreaterThan\(\s*5\s*\)/.test(integSrc)
check(
  'Negative-test proof  the money-column test cannot pass vacuously',
  hasSanityGuard,
  hasSanityGuard
    ? 'test asserts checked > 5, so an empty column set fails rather than passing'
    : 'NO sanity assertion — the money test could pass while inspecting zero columns',
)

// ---------------------------------------------------------------- real test suite
let suiteOk = false
let suiteEvidence = ''
try {
  const out = execFileSync('pnpm', ['test'], { cwd: ROOT, encoding: 'utf8', shell: true })
  suiteOk = /Tests\s+\d+\s+passed/.test(out.replace(/\u001b\[[0-9;]*m/g, '')) && !/failed/.test(out.replace(/\u001b\[[0-9;]*m/g, ''))
  suiteEvidence = out.replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ')
} catch (e) {
  suiteEvidence = (e as { stdout?: string }).stdout?.replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ') ?? 'suite failed'
}
check('Test suite  pnpm test passes', suiteOk, suiteEvidence)

let tcOk = false
try {
  execFileSync('pnpm', ['typecheck'], { cwd: ROOT, encoding: 'utf8', shell: true })
  tcOk = true
} catch { /* stays false */ }
check('Typecheck  pnpm typecheck clean', tcOk, tcOk ? 'exit 0' : 'typecheck reported errors')

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
    '## F011 — SQLite migrations from a fresh checkout',
    '',
    `**Verified:** ${new Date().toISOString()} · **Verifier:** orchestrating agent (self-verification)`,
    `**Verdict:** ${verdict} (${results.length - failed.length}/${results.length} checks passed)`,
    '',
    '| Check | Result | Evidence |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.step} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.evidence.replace(/\|/g, '\\|').slice(0, 200)} |`),
    '',
    '**Method note:** verified through a SEPARATE database connection, not the migration',
    "runner's own path — a self-check sharing code with the thing it checks proves nothing.",
    '',
    '**Inconclusive (cannot verify here):** SPEC-003 AC-2 — the same migrations applying to a',
    'Postgres database. No Postgres server exists on this machine (no Docker, no psql), and',
    'ADR-003 already records this as an open gap. It is NOT a passing test.',
    '',
    `**\`passes\` for F011:** ${failed.length === 0 ? 'eligible to set true' : 'must remain false'}`,
    '',
  ].join('\n'),
)

console.log(`\n=== VERDICT: ${verdict} (${results.length - failed.length}/${results.length}) ===`)
console.log(`Logged to docs/logs/BUILD_LOG.md`)

// Cleanup only the scratch dir this script created.
rmSync(scratch, { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)
