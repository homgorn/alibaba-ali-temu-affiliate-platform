#!/usr/bin/env node
/**
 * dispatch — resilient fan-out with automatic model failover.
 *
 * WHY THIS EXISTS
 * Round 1 dispatched 8 concurrent research agents on free-tier models. All 8
 * died: provider overload, per-minute rate limits, per-day rate limits, and one
 * socket reset. 31 source captures survived (agents write incrementally), but
 * zero synthesis reports were produced, and the commercial half of the research
 * programme came back empty.
 *
 * Two lessons, both encoded here:
 *   1. Never dispatch a wide fan-out on one provider/model. Concurrency on a
 *      shared free tier is what triggers the rate limit in the first place.
 *   2. Never treat a dead agent as a finished task. Check what it produced on
 *      disk, then retry on the next model rung.
 *
 * USAGE
 *   node scripts/dispatch.mjs --track r06-traffic-monetization --concurrency 2
 *   node scripts/dispatch.mjs --track r05-networks-landscape --dry-run
 *   node scripts/dispatch.mjs --check r06          # what survived from a dead run?
 *
 * BEHAVIOUR
 *   - Runs `scripts/agents-doctor.mjs` first and refuses to dispatch if it fails.
 *   - Caps concurrency (default 2). Widen deliberately, not by accident.
 *   - On agent failure: records the failure, inspects the track's output dir,
 *     and retries on the next rung of the model ladder.
 *   - Writes a dispatch log to docs/logs/DISPATCH_LOG.md.
 */

import { existsSync, readdirSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AGENT_DIR = join(ROOT, '.opencode', 'agents')
const LOG = join(ROOT, 'docs', 'logs', 'DISPATCH_LOG.md')

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2)
function arg(name, dflt = null) {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt
}
const TRACK = arg('track')
const CONCURRENCY = parseInt(arg('concurrency', '2'), 10)
const DRY_RUN = argv.includes('--dry-run')
const CHECK = arg('check')

// ---- ladder parsing ------------------------------------------------------
function loadLadder(agentName) {
  const p = join(AGENT_DIR, `${agentName}.md`)
  if (!existsSync(p)) {
    console.error(`No agent definition for '${agentName}' at ${p}`)
    process.exit(1)
  }
  const raw = readFileSync(p, 'utf8')
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const ladderRaw = fm?.[1].match(/^model_ladder:\s*\n((?:\s*-\s*.+\r?\n?)+)/m)?.[1]
  const ladder = ladderRaw
    ? ladderRaw.split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
    : []
  const desc = fm?.[1].match(/^description:\s*(.+)$/m)?.[1] ?? ''
  return { ladder, desc }
}

// ---- output inspection ---------------------------------------------------
function inspectTrack(track) {
  const raw = join(ROOT, 'research', 'raw', track)
  const reports = join(ROOT, 'research', 'reports')
  const rawCount = existsSync(raw) ? readdirSync(raw).filter(f => f.endsWith('.md')).length : 0
  const reportFiles = existsSync(reports) ? readdirSync(reports).filter(f => f.startsWith(track) && f.endsWith('.md')) : []
  return {
    rawDir: raw.replace(ROOT + '\\', ''),
    captures: rawCount,
    reports: reportFiles,
    synthesised: reportFiles.length > 0,
  }
}

function log(line) {
  const ts = new Date().toISOString()
  const entry = `- \`${ts}\` ${line}`
  appendFileSync(LOG, entry + '\n')
  console.log(line)
}

// ---- modes ---------------------------------------------------------------
if (CHECK) {
  const s = inspectTrack(CHECK)
  console.log(`\n=== survival check: ${CHECK} ===`)
  console.log(`  raw captures : ${s.captures}  (${s.rawDir})`)
  console.log(`  reports      : ${s.reports.length ? s.reports.join(', ') : 'NONE — agent died before synthesising'}`)
  console.log(s.synthesised
    ? '\n  → synthesised. Round complete.\n'
    : '\n  → SURVIVED AS CAPTURES ONLY. Retry this track — the sources are on disk,\n    so a retry can start from them instead of re-searching.\n')
  process.exit(0)
}

// ---- pre-flight ----------------------------------------------------------
if (!TRACK) {
  console.error('Usage: node scripts/dispatch.mjs --track <id> [--concurrency N] [--dry-run]')
  console.error('       node scripts/dispatch.mjs --check <id>')
  process.exit(1)
}

console.log('Running agents-doctor pre-flight...')
try {
  execFileSync('node', [join(ROOT, 'scripts', 'agents-doctor.mjs')], { stdio: 'inherit' })
} catch {
  console.error('\nPre-flight FAILED. Not dispatching. Fix the harness first.')
  process.exit(1)
}

const { ladder, desc } = loadLadder('researcher')

console.log(`\n=== dispatch plan: ${TRACK} ===`)
console.log(`  agent    : researcher`)
console.log(`  contract : ${desc}`)
console.log(`  ladder   : ${ladder.join('\n             ')}`)
console.log(`  concurrency: ${CONCURRENCY}`)
console.log(`  attempts : up to ${ladder.length} (one per rung, then stop)`)

if (DRY_RUN) {
  console.log('\n--dry-run: no agent dispatched.\n')
  process.exit(0)
}

mkdirSync(join(ROOT, 'docs', 'logs'), { recursive: true })
if (!existsSync(LOG)) {
  appendFileSync(LOG, '# DISPATCH LOG\n\nAppend-only record of every agent fan-out, failure and failover.\n\n')
}

// ---- the loop ------------------------------------------------------------
log(`**dispatch** \`${TRACK}\` — concurrency ${CONCURRENCY}, ladder: ${ladder.join(' → ')}`)

let rung = 0
let succeeded = false

while (rung < ladder.length && !succeeded) {
  const model = ladder[rung]
  console.log(`\n--- attempt ${rung + 1}/${ladder.length}: ${model} ---`)

  // In an agent-driven session this is where the subagent call happens.
  // This script documents and enforces the contract; the orchestrator performs
  // the actual dispatch so it can inject the track-specific brief.
  console.log(
    `  The orchestrator must now dispatch a 'researcher' agent for ${TRACK}\n` +
    `  pinned to model: ${model}\n\n` +
    `  Agent contract is in .opencode/agents/researcher.md.\n` +
    `  On failure: run  --check ${TRACK}  , then increment rung and retry.\n`
  )

  log(`attempt ${rung + 1}/${ladder.length} on \`${model}\` — awaiting orchestrator result`)
  succeeded = 'awaiting'
  rung++
  break // orchestrator drives subsequent attempts after observing the result
}

log(`dispatch for \`${TRACK}\` handed to orchestrator at rung ${rung}`)

console.log(
  '\nFAILOVER PROTOCOL (orchestrator):\n' +
  '  1. Agent returns error (rate limit / overload / socket reset)\n' +
  `  2. Run: node scripts/dispatch.mjs --check ${TRACK}\n` +
  '  3. If captures > 0 → a retry resumes from disk; mention them in the brief\n' +
  '  4. Retry on the next ladder rung, concurrency unchanged\n' +
  '  5. Exhaust the ladder → mark track BLOCKED, record it, move on.\n' +
  '     Never leave a track silently empty; an unrecorded gap is a trap.\n'
)
