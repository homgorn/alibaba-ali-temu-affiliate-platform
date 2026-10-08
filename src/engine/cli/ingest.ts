/**
 * Ingest CLI — `pnpm ingest -- <file.csv>`.
 *
 * F012. Requires NO API credentials (SPEC-001 FR-7 / NFR-8): a CSV file is a
 * complete, valid source. This is the deliberate answer to the API approval
 * queue being outside our control.
 */

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { detectEngine } from '../db/dialect.ts'
import { createSqliteRunner } from '../db/sqlite-runner.ts'
import { ingestCsv, IngestError } from '../ingest/ingest-csv.ts'
import { parseSafetyConfig, SafetyConfigError } from '../ingest/safety.ts'
import { loadEnv, resolveRunner } from './migrate.ts'

const ROOT = join(import.meta.dirname, '../../..')

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 ? argv[i + 1] : undefined
}

export function main(argv = process.argv.slice(2)): number {
  loadEnv()

  const file = argv.find((a) => !a.startsWith('--') && a !== flag(argv, 'network'))
  if (!file) {
    console.error('Usage: pnpm ingest -- <file.csv> [--network <id>] [--expected-rows <n>]')
    return 2
  }

  const networkId = flag(argv, 'network') ?? 'aliexpress'
  const expected = flag(argv, 'expected-rows')
  // Escape hatch for tests and deterministic replays at a fixed instant.
  const argsStableObservedAt = flag(argv, 'observed-at')

  let csvText: string
  try {
    csvText = readFileSync(file, 'utf8')
  } catch (err) {
    console.error(`✗ cannot read ${file}: ${(err as Error).message}`)
    return 1
  }

  // EC-11: refuse to start with a blank safety list. Checked before any DB work
  // so the failure is unambiguous.
  let safety
  try {
    safety = parseSafetyConfig(process.env.SAFETY_EXCLUDED_CATEGORIES)
  } catch (err) {
    if (err instanceof SafetyConfigError) {
      console.error(`✗ ${err.message}`)
      return 1
    }
    throw err
  }

  const url = process.env.DATABASE_URL ?? 'file:./data/dev.db'
  let runner
  try {
    detectEngine(url)
    runner = resolveRunner(url)
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`)
    return 1
  }

  try {
    // observedAt is derived from the FILE's modification time, not the clock.
    //
    // Reason (SPEC-001 FR-9 / AC-3): re-running the SAME feed must be
    // idempotent. If the timestamp came from the current time, every re-run
    // would create a new price observation and the price series would grow
    // without bound — the verifier caught exactly this. Keying the observation
    // to the file's own mtime means an unchanged file replays as unchanged,
    // while an updated file genuinely produces a new point in the history.
    const mtime = statSync(file).mtime
    const observedAt = argsStableObservedAt ?? mtime.toISOString()

    const res = ingestCsv(runner, csvText, {
      networkId,
      moduleId: `csv:${networkId}`,
      source: 'csv',
      safety,
      expectedRowCount: expected ? Number.parseInt(expected, 10) : undefined,
      now: new Date(observedAt),
    })

    console.log(`✓ ingested ${file}`)
    console.log(`  run            ${res.runId}`)
    console.log(`  observed at    ${observedAt}  (from file mtime — stable across replays)`)
    console.log(`  rows read      ${res.rowsRead}`)
    console.log(`  rows written   ${res.rowsWritten}`)
    console.log(`  rows unchanged ${res.rowsUnchanged}`)
    console.log(`  safety excluded ${res.rowsExcludedSafety}`)
    console.log(`  dead-lettered  ${res.deadLettered}`)
    console.log(`  outcome        ${res.outcome}`)
    console.log(`  duration       ${res.durationMs} ms`)

    for (const e of res.errors) console.log(`  ! ${e}`)

    // AC-3: a second run must write nothing new. Report it plainly.
    if (res.rowsWritten === 0 && res.rowsUnchanged > 0) {
      console.log(`\n  idempotent: ${res.rowsUnchanged} rows already matched, 0 changed`)
    }

    return res.deadLettered > 0 ? 1 : 0
  } catch (err) {
    if (err instanceof IngestError) {
      console.error(`✗ ${err.code}: ${err.message}`)
      console.error(`\n  No rows were written — the batch is rejected as a whole (SPEC-001 FR-8).`)
      return 1
    }
    console.error(`✗ ${(err as Error).message}`)
    return 1
  } finally {
    runner.close()
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  process.exit(main())
}
