/**
 * Independent verification of F004 — subagent definitions with inherited rules.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const AGENTS_DIR = join(ROOT, '.opencode/agents')
const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string): boolean {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
  return ok
}

const expected = ['analyst.md','architect.md','explorer.md','implementer.md','lawyer.md','researcher.md','verifier.md']
const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'))

check('F004  7 agent files present', files.length === 7 && expected.every(e => files.includes(e)), `found: ${files.join(', ')}`)

for (const f of expected) {
  const content = readFileSync(join(AGENTS_DIR, f), 'utf8')
  check(`F004  ${f} inherits R1 (no deletion)`, /R1|no deletion|double confirmation/i.test(content), 'rule found')
  check(`F004  ${f} inherits R2 (never fabricate)`, /R2|never fabricate|UNVERIFIED/i.test(content), 'rule found')
}

const verifier = readFileSync(join(AGENTS_DIR, 'verifier.md'), 'utf8')
check('F004  verifier is read-only (forbidden from writing)', /read.?only|may not write|must not write|forbidden.*write/i.test(verifier), 'restriction found')

const agentsMd = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
check('F004  AGENTS.md section 3 names the same 7 agents', expected.every(e => agentsMd.includes(e.replace('.md',''))), 'all named')

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)