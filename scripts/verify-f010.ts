/**
 * Independent verification of F010 — ADR-001 through ADR-004 written.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string): boolean {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
  return ok
}

const adrDir = join(ROOT, 'docs/adr')
const files = readdirSync(adrDir).filter(f => f.endsWith('.md')).sort()
check('F010  4 ADR files present', files.length === 4, files.join(', '))

const expected = ['ADR-001-static-first-framework.md','ADR-002-hosting.md','ADR-003-database.md','ADR-004-markdown-serving.md']
for (const f of expected) {
  check(`F010  ${f} exists`, files.includes(f), 'found')
  const content = readFileSync(join(adrDir, f), 'utf8')
  check(`F010  ${f} has Context`, /^## Context|^### Context|^Context:/m.test(content), 'found')
  check(`F010  ${f} has Decision`, /^## Decision|^### Decision|^Decision:/m.test(content), 'found')
  check(`F010  ${f} has Alternatives with pros/cons`, /Alternative|Pros.*Cons|Pros.*cons|pros.*cons/i.test(content), 'found')
  check(`F010  ${f} has Consequences`, /^## Consequence|^### Consequence|^Consequences:/m.test(content), 'found')
}

// ADR-001 specifically compares Next.js and Astro
const adr001 = readFileSync(join(adrDir, 'ADR-001-static-first-framework.md'), 'utf8')
check('F010  ADR-001 compares Next.js and Astro', /Next\.js.*Astro|Astro.*Next\.js/i.test(adr001), 'found')

// ADR-002 states Cloudflare payment/Worker reachability, marks UNVERIFIED
const adr002 = readFileSync(join(adrDir, 'ADR-002-hosting.md'), 'utf8')
check('F010  ADR-002 states Cloudflare payment from Russian ИП', /payment.*ИП|ИП.*payment|Cloudflare.*payment/i.test(adr002), 'found')
check('F010  ADR-002 marks unverified items as UNVERIFIED', /UNVERIFIED/i.test(adr002), 'found')

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)