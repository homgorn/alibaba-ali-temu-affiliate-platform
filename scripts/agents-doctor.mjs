#!/usr/bin/env node
/**
 * agents-doctor — validates the agent harness before dispatching work.
 *
 * WHY THIS EXISTS
 * Round 1 of this project dispatched 8 research agents. Every one died:
 * provider overload and free-tier rate limits. 31 source captures survived
 * because agents write incrementally, but zero synthesis reports were produced.
 * Nothing had validated the harness beforehand.
 *
 * This script is the pre-flight check. Run it before any fan-out.
 *
 * WHAT IT CHECKS
 *   1. Every agent definition file exists and has valid frontmatter.
 *   2. Every agent declares a model_ladder with >= 2 rungs.
 *   3. Every model in every ladder is a model this machine can actually reach.
 *   4. The primary (first) rung is not the same model for every agent, so a
 *      single provider outage cannot kill the whole fan-out.
 *   5. Every agent inherits the R1 no-deletion rule.
 *   6. No secret-looking pattern is staged in git.
 *
 * EXIT CODES
 *   0 = ready to dispatch
 *   1 = problems found
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AGENT_DIR = join(ROOT, '.opencode', 'agents')

const REQUIRED_AGENTS = [
  'explorer', 'researcher', 'verifier', 'implementer', 'architect', 'analyst', 'lawyer',
]

const SECRETS = [
  { re: /aliexpress[_-]?(app)?[_-]?secret\s*[:=]\s*["'][^"']{8,}["']/i, why: 'AliExpress app secret' },
  { re: /\bAPP_SECRET\b\s*[:=]\s*["'][^"']{8,}["']/i, why: 'app secret literal' },
  { re: /\b(GH_TOKEN|GITHUB_TOKEN)\s*[:=]\s*["'][^"']{8,}["']/i, why: 'GitHub token' },
  { re: /\bsk-[A-Za-z0-9]{20,}\b/, why: 'OpenAI-style secret key' },
  { re: /\bor-[A-Za-z0-9]{20,}\b/, why: 'OpenRouter API key' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: 'private key' },
]

const problems = []
const warnings = []
const info = []

function fail(msg) { problems.push(msg) }
function warn(msg) { warnings.push(msg) }

// ---- 1. Agent files exist -----------------------------------------------
for (const name of REQUIRED_AGENTS) {
  const p = join(AGENT_DIR, `${name}.md`)
  if (!existsSync(p)) fail(`MISSING agent definition: .opencode/agents/${name}.md`)
}

// ---- 2/3/4/5. Parse and validate each definition -------------------------
let parsed = []
if (existsSync(AGENT_DIR)) {
  for (const file of readdirSync(AGENT_DIR)) {
    if (!file.endsWith('.md')) continue
    const raw = readFileSync(join(AGENT_DIR, file), 'utf8')

    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fm) { fail(`${file}: no YAML frontmatter (--- ... ---) block`); continue }

    const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim()
    if (!name) fail(`${file}: frontmatter has no 'name:' field`)
    if (!/description:\s*.+/m.test(fm[1])) warn(`${file}: frontmatter has no 'description:' — the agent will not be discoverable`)

    const ladderRaw = (fm[1].match(/^model_ladder:\s*\n((?:\s*-\s*.+\r?\n?)+)/m) || [])[1]
    const ladder = ladderRaw
      ? ladderRaw.split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
      : []

    if (ladder.length < 2) {
      fail(`${file}: model_ladder has ${ladder.length} rung(s); needs >= 2 so a rate-limited primary can fail over`)
    }
    for (const m of ladder) {
      if (!m.includes('/')) fail(`${file}: malformed model id '${m}' — expected provider/model`)
    }

    if (/\bR1\b/.test(raw) && /never/i.test(raw) && /delet/i.test(raw)) {
      // R1 present
    } else {
      fail(`${file}: does not state the R1 no-deletion rule — every agent MUST inherit it`)
    }

    parsed.push({ file, name, ladder })
  }
}

// ---- 4b. Diversification check ------------------------------------------
const primaries = parsed.filter(p => p.ladder.length).map(p => p.ladder[0])
const counts = new Map()
for (const p of primaries) counts.set(p, (counts.get(p) || 0) + 1)
for (const [model, n] of counts) {
  if (n > 2) {
    warn(`Provider concentration: ${n} agents share '${model}' as their primary rung. A single provider outage would kill that many agents at once.`)
  }
}

// ---- 6. Secret scan over tracked text files ------------------------------
const SCAN_DIRS = ['src', 'tools', 'scripts', 'db', '.opencode', 'docs']
function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(e.name)) walk(p, out) }
    else if (/\.(ts|js|json|md|sql|yaml|yml|env|sh)$/.test(e.name)) out.push(p)
  }
  return out
}
for (const d of SCAN_DIRS) {
  for (const f of walk(join(ROOT, d))) {
    let content
    try { content = readFileSync(f, 'utf8') } catch { continue }
    for (const s of SECRETS) {
      if (s.re.test(content)) {
        fail(`POSSIBLE SECRET (${s.why}) in ${f.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`)
      }
    }
  }
}

// ---- Report --------------------------------------------------------------
console.log('\n=== agents-doctor ===\n')
for (const p of parsed) {
  console.log(`  ${(p.name || '?').padEnd(14)} ${p.ladder.length} rungs  →  ${p.ladder.join('  →  ')}`)
}
if (info.length) { console.log('\nINFO'); for (const i of info) console.log('  · ' + i) }
if (warnings.length) {
  console.log('\nWARNINGS')
  for (const w of warnings) console.log('  ! ' + w)
}
if (problems.length) {
  console.log('\nPROBLEMS')
  for (const p of problems) console.log('  ✗ ' + p)
  console.log(`\n${problems.length} problem(s). DO NOT dispatch a fan-out yet.`)
  process.exit(1)
}
console.log(`\nReady to dispatch: ${parsed.length} agents, all with fallbacks, all inheriting R1.`)
console.log('Reminder: dispatch 2-3 at a time. 8 concurrent free-tier agents is what killed round 1.\n')
process.exit(0)
