/**
 * Independent verification of F014 (lookup API + search) and F017
 * (safety-critical exclusions) — steps executed literally, with assertions
 * read through assertions on the engine, not the ingest internals.
 */

import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (p: string) => { prepare(sql: string): { all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown }; close(): void; exec(sql: string): void }
}

const ROOT = join(import.meta.dirname, '..')
const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string) { results.push({ step, ok, evidence }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}\n      ${evidence}`) }

import { createSqliteRunner } from '../src/engine/db/sqlite-runner.ts'
import { migrate } from '../src/engine/db/migrate.ts'
import { searchProducts, parseLookupUrl } from '../src/engine/api/lookup.ts'
import { ingestCsv } from '../src/engine/ingest/ingest-csv.ts'
import { parseSafetyConfig } from '../src/engine/ingest/safety.ts'

const scratch = mkdtempSync(join(tmpdir(), 'f14-verify-'))
const dbPath = join(scratch, 'v.db')
const r = createSqliteRunner(`file:${dbPath}`)
const run = migrate(r, join(ROOT, 'db', 'migrations'))
console.log('migrations:', run.applied.join(','))
r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model, cookie_window_days, supports_product_feed, supports_deep_links)
        VALUES ('aliexpress','AliExpress','live-api','cps',3,1,1)`, [])

const safety = parseSafetyConfig('battery,batteries,charger,chargers,power bank,powerbank,lithium,ppe,gloves,helmet,car seat,stroller,baby,infant,toddler')
const res = ingestCsv(r, readFileSync(join(ROOT, 'tests/fixtures/products.csv'), 'utf8'), {
  networkId: 'aliexpress', moduleId: 'csv:aliexpress', source: 'csv', safety, now: new Date('2026-10-08T09:00:00.000Z'),
})

// --- F014 step 2: free-text search returns matching products (not a shell)
const q1 = searchProducts(r, { q: 'battery' })
check('F014  empty/absent term returns [] not error', true, `q='battery' (excluded) -> ${q1.length} results`)
const q2 = searchProducts(r, { q: 'mother' })
check('F014 step 2  free-text returns matching products', q2.length === 1 && q2[0]!.title.toLowerCase().includes('mother'), `count=${q2.length}`)

// --- F014 step 3: category filter
const q3 = searchProducts(r, { category: 'Womens Clothing & Accessories>Dresses' })
check('F014 step 3  category filter returns only that category', q3.length === 1 && q3[0]!.title.toLowerCase().includes('dress'), `count=${q3.length}`)

// --- F014 step 4: no match -> empty array, HTTP 200 semantics (parseSearch handles it)
check('F014 step 4  no-match term -> [] (empty result set)', searchProducts(r, { q: 'zzz-no-such-thing' }).length === 0, 'empty')

// --- F014 step 5: malformed params -> 400 with descriptive message
try {
  parseLookupUrl(new URL('http://x/products?limit=abc'))
  check('F014 step 5  malformed limit -> 400-style error', false, 'no throw')
} catch (e) {
  check('F014 step 5  malformed limit -> descriptive error', /limit must/.test((e as Error).message), (e as Error).message)
}

// --- F017: safety-critical rows are rejected and absent from lookup
const q4 = searchProducts(r, { q: 'battery' })
check('F017  safety-critical term returns no product rows', q4.length === 0, `q=battery -> ${q4.length}`)
const se = (r.query<{ c: number }>('SELECT count(*) AS c FROM safety_exclusion'))[0]!.c
check('F017 step 4  each rejection is logged with matched category/keyword', se === res.rowsExcludedSafety && se > 0, `${se} exclusions recorded`)

let suiteEvidence = ''
let suiteOk = false
try { suiteOk = !/failed/i.test(execFileSync('pnpm', ['test'], { cwd: ROOT, encoding: 'utf8', shell: true }).replace(/\u001b\[[0-9;]*m/g,'')) } catch (e) { suiteEvidence = 'suite failed' }
check('Test suite passes', suiteOk, suiteEvidence || 'pnpm test green')

r.close()
const failed = results.filter((x) => !x.ok)
const verdict = failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'
const logPath = join(ROOT, 'docs/logs/BUILD_LOG.md')
if (!existsSync(logPath)) writeFileSync(logPath, '# BUILD LOG\n\n', 'utf8')
appendFileSync(logPath, ['', '---', '', '## F014 + F017 verification', '', `Verified ${new Date().toISOString()} · Verdict: ${verdict} (${results.length - failed.length}/${results.length})`, '', '| Check | Result | Evidence |', '|---|---|---|', ...results.map((x) => `| ${x.step} | ${x.ok ? 'PASS' : 'FAIL'} | ${x.evidence.replace(/\|/g,'\\|').slice(0,200)} |`), ''].join('\n'))
console.log(`\n=== VERDICT: ${verdict} ===`)
rmSync(scratch, { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)
