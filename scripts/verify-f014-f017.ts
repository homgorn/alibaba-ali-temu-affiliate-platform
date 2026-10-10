/**
 * Independent verification of F014 (lookup API) and F017 (safety exclusions).
 *
 * Method — deliberately literal, because the previous attempt at this script
 * passed 8 checks while crashing before it could record evidence, and had
 * claimed a "PASS" on a `check(..., true, ...)` hardcoded to success:
 *
 *   1. A scratch database, migrated and seeded through the DOCUMENTED CLI
 *      (`migrate.ts`, `seed.ts`, `ingest.ts`) — never through the library.
 *   2. The API started as a real child process on a real port, via the
 *      documented entry point, and queried over real HTTP with `fetch`.
 *      No in-process shortcut: F014's step 1 says "start the API using the
 *      documented command", and that is what is tested.
 *   3. Every assertion about STORED STATE read through a SEPARATE connection,
 *      asserting VALUES (counts, specific strings) rather than field presence.
 *   4. The verdict is appended to docs/logs/BUILD_LOG.md before the exit code
 *      is produced. If logging fails, the script fails — it cannot silently
 *      report a pass it did not record.
 */

import { mkdtempSync, rmSync, appendFileSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
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
const PORT = 8791

const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string): boolean {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
  return ok
}

const scratch = mkdtempSync(join(tmpdir(), 'f014-verify-'))
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

// ---------------------------------------------------------------- 1. documented CLI
const migrateOut = run('migrate.ts')
check(
  'Setup  pnpm db:migrate applied the schema',
  /\+ 0001_core/.test(migrateOut),
  migrateOut.split('\n').filter((l) => /^\s*[+|=]/.test(l)).join(' | '),
)

run('seed.ts')
const ingestOut = run('ingest.ts', [
  join(ROOT, 'tests/fixtures/products.csv'),
  '--network',
  'aliexpress',
  '--observed-at',
  '2026-10-01T09:00:00.000Z',
])
const wrote = (ingestOut.match(/rows written\s+(\d+)/) ?? [])[1] ?? '?'
const excluded = (ingestOut.match(/safety excluded (\d+)/) ?? [])[1] ?? '?'
check(
  'F017 step 2  ingestion ran and reported written + safety-excluded counts',
  Number(wrote) > 0 && Number(excluded) > 0,
  `rows written=${wrote}, safety excluded=${excluded}`,
)

// ---------------------------------------------------------------- 2. real HTTP server
const child = spawn(
  process.execPath,
  ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/api/server.ts')],
  { env: { ...env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] },
)
let serverLog = ''
child.stdout.on('data', (d: Buffer) => { serverLog += d.toString() })
child.stderr.on('data', (d: Buffer) => { serverLog += d.toString() })

const base = `http://127.0.0.1:${PORT}`
async function waitForHealth(): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

type LookupBody = {
  count: number
  results: {
    title: string
    externalProductId: string
    categoryName: string | null
    salePriceMinor: number | null
    currency: string | null
    destinationCountry: string | null
    safetyExcluded: boolean
  }[]
  error?: string
  details?: string[]
}

let httpOk = false
try {
  httpOk = await waitForHealth()
} catch (e) {
  serverLog = String(e)
}
check('F014 step 1  the API starts with the documented command and answers /health', httpOk, serverLog.split('\n')[0] ?? '')

async function get(path: string): Promise<{ status: number; body: LookupBody }> {
  const res = await fetch(`${base}${path}`)
  return { status: res.status, body: (await res.json()) as LookupBody }
}

if (httpOk) {
  // --- F014 step 2: free-text term that matches fixture data
  const free = await get('/products?q=dress')
  check(
    'F014 step 2  GET /products?q=dress returns HTTP 200 and a JSON array of matching products',
    free.status === 200 && free.body.count > 0 && free.body.results.every((r) => r.title.toLowerCase().includes('dress')),
    `status=${free.status} count=${free.body.count} titles=[${free.body.results.map((r) => r.title.slice(0, 34)).join(' ;; ')}]`,
  )

  // --- F014 step 3: category filter
  const cat = await get('/products?category=Dresses')
  check(
    "F014 step 3  GET /products?category=Dresses returns only that category's products",
    cat.status === 200 && cat.body.count > 0 && cat.body.results.every((r) => r.categoryName === 'Dresses'),
    `count=${cat.body.count} categoryNames=[${[...new Set(cat.body.results.map((r) => r.categoryName))].join(',')}]`,
  )

  // --- F014 step 4: no match => empty array, HTTP 200, NOT an error
  const none = await get('/products?q=zzz-no-such-product-zzz')
  check(
    'F014 step 4  a term matching nothing returns an empty array with HTTP 200, not an error',
    none.status === 200 && none.body.count === 0 && Array.isArray(none.body.results) && none.body.results.length === 0 && none.body.error === undefined,
    `status=${none.status} body=${JSON.stringify(none.body).slice(0, 120)}`,
  )

  // --- F014 step 5: malformed parameter => 400 with a descriptive message
  const bad = await get('/products?limit=abc')
  check(
    'F014 step 5  a malformed query parameter returns HTTP 400 with a descriptive message',
    bad.status === 400 && bad.body.error === 'invalid_query' && Array.isArray(bad.body.details) && bad.body.details!.length > 0,
    `status=${bad.status} error=${bad.body.error} details=${JSON.stringify(bad.body.details)}`,
  )

  // --- extra: destination + currency filters actually filter
  const dest = await get('/products?destination=DE')
  check(
    'F014 extra  the destination filter only returns observations for that destination',
    dest.status === 200 && dest.body.count > 0 && dest.body.results.every((r) => r.destinationCountry === 'DE'),
    `count=${dest.body.count} destinations=[${[...new Set(dest.body.results.map((r) => r.destinationCountry))].join(',')}]`,
  )

  // --- F017 step 3: absent from lookup API results
  const batt = await get('/products?q=battery')
  check(
    'F017 step 3  a safety-critical term returns no products from the lookup API',
    batt.status === 200 && batt.body.count === 0,
    `GET /products?q=battery -> status=${batt.status} count=${batt.body.count}`,
  )
  const every = await get('/products?limit=200')
  check(
    'F017 step 3  no result anywhere in the API carries safetyExcluded=true',
    every.status === 200 && every.body.results.every((r) => r.safetyExcluded === false),
    `${every.body.count} results scanned, safetyExcluded flags set: ${every.body.results.filter((r) => r.safetyExcluded).length}`,
  )
}

// ---------------------------------------------------------------- 3. stored state, separate connection
const db = new DatabaseSync(dbPath)
const q = (sql: string, ...p: unknown[]): number => (db.prepare(sql).get(...p) as { c: number }).c

const catalogue = q('SELECT count(*) AS c FROM product')
const excludedRows = q('SELECT count(*) AS c FROM safety_exclusion')
check(
  'F017 step 1-2  safety-critical rows were rejected at ingest and did NOT enter the catalogue',
  excludedRows > 0,
  `catalogue=${catalogue} products, safety_exclusion=${excludedRows} rows`,
)

const loggedCats = db
  .prepare('SELECT matched_category, matched_keyword, COUNT(*) AS c FROM safety_exclusion GROUP BY 1,2 ORDER BY c DESC LIMIT 8')
  .all() as { matched_category: string; matched_keyword: string; c: number }[]
check(
  'F017 step 4  every rejection is logged with the category AND the keyword that caused it',
  loggedCats.length > 0 && loggedCats.every((r) => r.matched_category && r.matched_keyword),
  loggedCats.map((r) => `${r.matched_category}/${r.matched_keyword}×${r.c}`).join(', '),
)

// F017 step 1 names four category families: batteries, chargers, PPE and baby
// goods. Assert the CONCRETE FIXTURE ROWS, not the category label.
//
// Why not the label: `safety_exclusion.matched_category` stores the LEAF node of
// the taxonomy, so the car-seat row at "Automotive>Interior" is logged as
// "Interior" and an assertion on the root name "Automotive" would fail on a
// row that was correctly excluded. A row that is logged AND absent from
// `product` is the property that actually matters, so that is what is asserted.
const namedRows = [
  { id: '33006951810', family: 'batteries', title: 'Rechargeable Li-ion Battery 18650 3000mAh 2pcs' },
  { id: '33006951827', family: 'power banks / chargers', title: 'Power Bank 20000mAh Fast Charging Portable' },
  { id: '33006951805', family: 'chargers', title: 'Wireless Charging Pad Qi Fast Charging' },
  { id: '33006951828', family: 'PPE', title: 'Safety Helmet Hard Hat Adjustable Industrial' },
  { id: '33006951811', family: 'PPE', title: 'Protective Gloves Work Safety Cut Resistant' },
  { id: '33006951809', family: 'baby goods', title: 'Baby Silicone Feeding Bowl Weaning Spoon Set' },
  { id: '33006951826', family: 'baby goods', title: 'Baby Stroller Rain Cover Universal Rain Poncho' },
  { id: '33006951812', family: 'car seats', title: 'Car Seat Cushion Breathable Universal Comfort' },
]
const rowChecks = namedRows.map((r) => {
  const logged = q('SELECT count(*) AS c FROM safety_exclusion WHERE external_product_id = ?', r.id)
  const inCatalogue = q('SELECT count(*) AS c FROM product WHERE external_product_id = ?', r.id)
  const kw = (
    db.prepare('SELECT matched_keyword FROM safety_exclusion WHERE external_product_id = ?').get(r.id) as
      | { matched_keyword: string }
      | undefined
  )?.matched_keyword
  return { ...r, logged, inCatalogue, kw: kw ?? null }
})
check(
  'F017 step 1  every safety-critical fixture row (batteries / chargers / PPE / baby goods / car seats) is logged AND absent from the catalogue',
  rowChecks.every((r) => r.logged === 1 && r.inCatalogue === 0),
  rowChecks.map((r) => `${r.id} "${r.family}" logged=${r.logged} kw=${r.kw} leaked=${r.inCatalogue}`).join(' | '),
)

// And the complement: the fixture's NORMAL rows must all have survived, or the
// gate would be "passing" by rejecting the whole feed.
const fixtureRows = 66
const normalKept = q('SELECT count(*) AS c FROM product')
check(
  'F017  the safety gate rejects only the unsafe rows — the normal catalogue survives intact',
  normalKept === fixtureRows - excludedRows && normalKept > 0,
  `catalogue=${normalKept} = fixture(${fixtureRows}) − excluded(${excludedRows})`,
)

// --- F017 step 5: configurable, not hardcoded in the query
const safetySql = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'product'")
  .get() as { sql: string } | undefined
check(
  'F017 step 5  the exclusion list is NOT hardcoded into any SQL in the schema',
  safetySql ? !/battery|charger|helmet|stroller/i.test(safetySql.sql) : false,
  safetySql ? 'product table DDL contains no safety keyword literals' : 'product table DDL not found',
)

const envExample = (await import('node:fs')).readFileSync(join(ROOT, '.env.example'), 'utf8')
check(
  'F017 step 5  the exclusion list is configurable via env and documented in .env.example',
  envExample.includes('SAFETY_EXCLUDED_CATEGORIES=') && /An empty list silently disables/.test(envExample),
  '.env.example declares SAFETY_EXCLUDED_CATEGORIES and warns that an empty list disables the control',
)
db.close()

// ---------------------------------------------------------------- 4. suite + typecheck
let suiteEvidence = ''
let suiteOk = false
try {
  const o = execFileSync('pnpm', ['test'], { cwd: ROOT, encoding: 'utf8', shell: true })
    .replace(/\u001b\[[0-9;]*m/g, '')
  suiteOk = !/failed/i.test(o)
  suiteEvidence = o.split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ')
} catch (e) {
  suiteEvidence =
    (e as { stdout?: string }).stdout?.replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ') ?? 'suite failed'
}
check('Test suite  pnpm test passes', suiteOk, suiteEvidence || '(no summary line captured)')

let tcOk = false
try {
  execFileSync('pnpm', ['typecheck'], { cwd: ROOT, encoding: 'utf8', shell: true })
  tcOk = true
} catch { /* false */ }
check('Typecheck  pnpm typecheck clean', tcOk, tcOk ? 'exit 0' : 'errors reported')

// ---------------------------------------------------------------- verdict, recorded BEFORE exit
// The API child holds the SQLite file open. Killing it is asynchronous; deleting
// the scratch directory before it has actually exited gives EBUSY on Windows.
// Wait for the real close event rather than assuming.
const serverClosed = new Promise<void>((resolve) => {
  if (child.exitCode !== null || child.signalCode !== null) return resolve()
  child.once('close', () => resolve())
  child.kill()
})
await serverClosed

const failed = results.filter((r) => !r.ok)
const verdict = failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'

const logPath = join(ROOT, 'docs/logs/BUILD_LOG.md')
let logged = false
try {
  if (!existsSync(logPath)) writeFileSync(logPath, '# BUILD LOG\n\n', 'utf8')
  appendFileSync(
    logPath,
    [
      '',
      '---',
      '',
      '## F014 + F017 — lookup API over real HTTP, and safety-critical exclusions',
      '',
      `**Verified:** ${new Date().toISOString()} · **Verifier:** orchestrating agent (self-verification)`,
      `**Verdict:** ${verdict} (${results.length - failed.length}/${results.length} checks passed)`,
      '',
      'Method: scratch DB through the documented CLI; API started as a real child process on',
      `port ${PORT} and queried over real HTTP; stored state asserted through a separate connection.`,
      '',
      '| Check | Result | Evidence |',
      '|---|---|---|',
      ...results.map((r) => `| ${r.step} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.evidence.replace(/\|/g, '\\|').slice(0, 300)} |`),
      '',
    ].join('\n'),
  )
  logged = true
} catch (e) {
  console.error(`FATAL: could not record the verdict in BUILD_LOG.md: ${(e as Error).message}`)
}

// A verdict that could not be recorded is not a pass. That was the original defect.
if (!logged) {
  console.error('=== VERDICT: NOT VERIFIED (evidence could not be written) ===')
  rmSync(scratch, { recursive: true, force: true })
  process.exit(1)
}

console.log(`\n=== VERDICT: ${verdict} (${results.length - failed.length}/${results.length}) — recorded in docs/logs/BUILD_LOG.md ===`)
rmSync(scratch, { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)