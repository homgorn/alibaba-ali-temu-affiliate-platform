/**
 * Independent verification of F009 — SPEC-004 static-first-web approved.
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

const spec = readFileSync(join(ROOT, 'docs/specs/SPEC-004-static-first-web.md'), 'utf8')

const sections = [
  'Context', 'Functional Requirements', 'Non-Functional Requirements',
  'Acceptance Criteria', 'Edge Cases', 'API Contracts', 'Out of Scope'
]
for (const s of sections) {
  check(`F009  Section "${s}" present`, new RegExp(`^#+\\s*\\d*\\.?\\s*${s}`, 'm').test(spec), 'found')
}

check('F009  HTML-first: no client-JS content', /no.*client.*JavaScript|client.*JavaScript.*not|server.rendered.*HTML/i.test(spec), 'found')
check('F009  .md twin convention defined', /\.md.*twin|twin.*\.md/i.test(spec), 'found')
check('F009  llms.txt at build time', /llms\.txt.*build|build.*llms\.txt/i.test(spec), 'found')
check('F009  robots.txt AI crawler policy', /robots\.txt|OAI-SearchBot|GPTBot/i.test(spec), 'found')
check('F009  Link headers for markdown', /Link.*header|rel.*alternate.*markdown/i.test(spec), 'found')
check('F009  L7 test strategy (fails build if content missing)', /L7|fails.*build|guard.*test/i.test(spec), 'found')
check('F009  Status: Approved', /status.*[:\s]?approved/i.test(spec), 'found')

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)