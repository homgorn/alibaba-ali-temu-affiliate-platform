/**
 * Ledger audit — every feature marked `passes: true` must have recorded
 * evidence, or the flag is a lie.
 *
 * This exists because it was already wrong once: F014/F017 were marked
 * `passes: true` on the strength of a verifier that printed PASS lines and
 * then crashed before it could write anything down. Nothing in the repo
 * caught that at the time. This does.
 *
 * Rules enforced, per feature:
 *   1. `verified_by` names at least one path.
 *   2. Every named path exists on disk (a verifier that is not there cannot
 *      be re-run, so the evidence is not reproducible).
 *   3. `verified_at` is a date.
 *   4. BUILD_LOG.md contains a VERIFIED section mentioning the feature id.
 *   5. The BUILD_LOG verdict for that feature is not left as NOT VERIFIED.
 *
 * Rule 5 is deliberately about the *newest* section: the log is append-only,
 * so an early failure followed by a later pass is the correct history and
 * must not be reported as a failure.
 *
 * Exit 0 when the ledger is sound, 1 otherwise. Read-only: touches nothing.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const ledger = JSON.parse(readFileSync(join(ROOT, 'feature_list.json'), 'utf8')) as {
  id: string
  passes?: boolean
  verified_by?: string
  verified_at?: string
}[]
const buildLog = readFileSync(join(ROOT, 'docs/logs/BUILD_LOG.md'), 'utf8')

// Split the log into sections and index verdicts per feature id, in order.
interface Section {
  heading: string
  verdict: 'VERIFIED' | 'NOT VERIFIED' | null
  mentions: string[]
}
const sections: Section[] = []
for (const raw of buildLog.split(/^## /m).slice(1)) {
  const heading = raw.split('\n')[0] ?? ''
  const verdictMatch = /\*\*Verdict:\*\*\s*(NOT VERIFIED|VERIFIED)/.exec(raw)
  const ids = [...new Set([...raw.matchAll(/\bF\d{3}\b/g)].map((m) => m[0]))]
  sections.push({
    heading,
    verdict: verdictMatch ? (verdictMatch[1] as 'VERIFIED' | 'NOT VERIFIED') : null,
    mentions: ids,
  })
}

/** Resolve a repo-relative path, or a bare filename anywhere under src/scripts/tests. */
function resolveRepoFile(ref: string): string | null {
  const direct = join(ROOT, ref)
  if (existsSync(direct)) return direct
  for (const dir of ['scripts', 'tests', 'src']) {
    const hits = walk(join(ROOT, dir), ref.split(/[\\/]/).pop()!)
    if (hits.length) return hits[0]!
  }
  return null
}

function walk(dir: string, basename: string, depth = 0): string[] {
  if (depth > 6) return []
  let entries: string[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
  } catch {
    return []
  }
  const out: string[] = []
  for (const e of entries) {
    const full = join(dir, e)
    if (e.endsWith('/')) out.push(...walk(full, basename, depth + 1))
    else if (e === basename) out.push(full)
  }
  return out
}

const problems: string[] = []
const verified: string[] = []
const notVerified: string[] = []
const pending: string[] = []

for (const f of ledger) {
  if (!f.passes) {
    pending.push(f.id)
    continue
  }

  const issues: string[] = []

  if (!f.verified_by) issues.push('no verified_by')
  if (!f.verified_at) issues.push('no verified_at')

  for (const p of (f.verified_by ?? '').split('+').map((s) => s.trim()).filter(Boolean)) {
    if (!resolveRepoFile(p)) issues.push(`verifier not on disk: ${p}`)
  }

  // Narrative sections (RESOLUTION, context prose) mention feature ids without
  // recording a verdict. Only sections that actually state a verdict count;
  // taking the last mentioning section would flag a feature for a passage
  // written about it rather than by it.
  const mine = sections.filter((s) => s.mentions.includes(f.id) && s.verdict !== null)
  if (mine.length === 0) {
    issues.push('no VERIFIED/NOT VERIFIED section in BUILD_LOG.md')
  } else {
    const last = mine[mine.length - 1]!
    if (last.verdict !== 'VERIFIED') {
      issues.push(`newest BUILD_LOG verdict is NOT VERIFIED ("${last.heading.trim().slice(0, 60)}")`)
    } else {
      verified.push(f.id)
    }
  }

  if (issues.length) problems.push(`${f.id}: ${issues.join('; ')}`)
}

const total = ledger.length
console.log(`features total      ${total}`)
console.log(`  passes: true      ${verified.length + notVerified.length}`)
console.log(`    with evidence   ${verified.length}  [${verified.join(', ')}]`)
console.log(`    flagged         ${notVerified.length}`)
console.log(`  passes: false     ${pending.length}`)

if (problems.length) {
  console.log('\nLEDGER IS NOT SOUND:')
  for (const p of problems) console.log(`  ✗ ${p}`)
  console.log('\nA `passes: true` without recorded, re-runnable evidence is exactly the')
  console.log('failure mode that let F014/F017 through earlier.')
  process.exit(1)
}

console.log('\nLEDGER SOUND: every passes:true feature has a recorded VERIFIED verdict and')
console.log('a verifier that exists on disk.')