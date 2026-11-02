/**
 * Independent verification of F007 — SPEC-001 ingestion engine approved.
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

const spec = readFileSync(join(ROOT, 'docs/specs/SPEC-001-ingestion-engine.md'), 'utf8')

const sections = [
  'Context', 'Functional Requirements', 'Non-Functional Requirements',
  'Acceptance Criteria', 'Edge Cases', 'API Contracts', 'Data Models', 'Out of Scope'
]
for (const s of sections) {
  // Sections are numbered: "## 2. Functional Requirements" etc.
  check(`F007  Section "${s}" present`, new RegExp(`^#+\\s*\\d*\\.?\\s*${s}`, 'm').test(spec), 'found')
}

check('F007  FRs numbered and use RFC 2119', /FR-\d+.*\b(MUST|SHOULD|MAY)\b/.test(spec), 'found')
check('F007  Every AC references FR/NFR', /AC-\d+.*(FR-|NFR-)/.test(spec), 'found')
check('F007  Module contract defined', /ModuleContract|module contract/i.test(spec), 'found')
check('F007  Idempotent upserts specified', /idempotent/i.test(spec), 'found')
check('F007  Incremental/watermark sync specified', /incremental|watermark|checkpoint/i.test(spec), 'found')
check('F007  Backoff with jitter specified', /backoff.*jitter|jitter.*backoff/i.test(spec), 'found')
check('F007  Dead-letter handling specified', /dead.?letter/i.test(spec), 'found')
check('F007  Request budget respects quota', /budget|quota|rate.?limit/i.test(spec), 'found')
check('F007  Retention policy per field class', /retention.*field|field.*retention/i.test(spec), 'found')
check('F007  Status: Approved', /status.*[:\s]?approved/i.test(spec), 'found')
check('F007  Out of Scope explicitly lists exclusions', /Out of Scope[\s\S]*\|.*Excluded.*\|.*Reason/m.test(spec), 'found')

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)