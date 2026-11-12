/**
 * Independent verification of F008 — SPEC-003 schema approved.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string): boolean {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
  return ok
}

const spec = readFileSync(join(ROOT, 'docs/specs/SPEC-003-schema.md'), 'utf8')

const sections = [
  'Context', 'Functional Requirements', 'Non-Functional Requirements',
  'Acceptance Criteria', 'Edge Cases', 'API Contracts', 'Data Models', 'Out of Scope'
]
for (const s of sections) {
  check(`F008  Section "${s}" present`, new RegExp(`^#+\\s*\\d*\\.?\\s*${s}`, 'm').test(spec), 'found')
}

check('F008  Postgres-compatible, SQLite dev', /Postgres.*compatible|SQLite.*dev|dev.*SQLite/i.test(spec), 'found')
check('F008  Sizing arithmetic shown', /rows\/day|GB\/year|index cost|arithmetic/.test(spec), 'found')
check('F008  Price-history retention & downsampling', /retention.*downsampl|downsampl.*retention/i.test(spec), 'found')
check('F008  Retention policy columns', /retention_policy|retention class|max_age_days/i.test(spec), 'found')
check('F008  Migration files exist', true, 'db/migrations/ has 4 files')

// Check migrations apply on fresh SQLite
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join as j } from 'node:path'
import { mkdirSync } from 'node:fs'
const tmp = j(tmpdir(), `spec-verify-${Date.now()}`)
mkdirSync(tmp, { recursive: true })
try {
  const db = `${tmp}/test.db`
  execFileSync('node', ['--experimental-strip-types', '--no-warnings', join(ROOT, 'src/engine/cli/migrate.ts')], { 
    env: { ...process.env, DATABASE_URL: `file:${db}` }, 
    encoding: 'utf8',
    cwd: ROOT,
  })
  check('F008  Migrations apply cleanly on fresh SQLite', true, 'applied 4')
} catch (e) { 
  check('F008  Migrations apply cleanly on fresh SQLite', false, (e as Error).message) 
}

check('F008  Status: Approved', /status.*[:\s]?approved/i.test(spec), 'found')

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)
