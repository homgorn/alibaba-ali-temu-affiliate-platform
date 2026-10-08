/**
 * Migration CLI — `pnpm db:migrate`.
 *
 * Feature F011, SPEC-003 AC-1 (fresh SQLite checkout), AC-2 (same migrations
 * on Postgres), AC-3 (idempotency), NFR-4 (<10 s).
 *
 * Loads .env without a dependency: this must work on a fresh checkout before
 * any install has happened beyond devDependencies.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { detectEngine } from '../db/dialect.ts'
import { createSqliteRunner } from '../db/sqlite-runner.ts'
import { migrate, status, type Runner } from '../db/migrate.ts'

const ROOT = join(import.meta.dirname, '../../..')
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')

/** Minimal .env loader. No dependency, and it never overwrites a real env var. */
export function loadEnv(path = join(ROOT, '.env')): void {
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}

export function resolveRunner(url: string): Runner {
  const engine = detectEngine(url)
  if (engine === 'sqlite') return createSqliteRunner(url)
  throw new Error(
    'Postgres runner is not implemented yet. Set DATABASE_URL to a SQLite URL ' +
      'for development (see ADR-003). SPEC-003 AC-2 requires Postgres parity, ' +
      'which is not yet verified — treat it as an open gap, not a passing test.',
  )
}

export function main(argv = process.argv.slice(2)): number {
  loadEnv()
  const url = process.env.DATABASE_URL ?? 'file:./data/dev.db'
  const asJson = argv.includes('--json')

  let runner: Runner
  try {
    runner = resolveRunner(url)
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`)
    return 1
  }

  if (argv.includes('--status')) {
    const s = status(runner, MIGRATIONS_DIR)
    const out = {
      engine: runner.engine,
      applied: s.applied.map((a) => a.id),
      pending: s.pending.map((p) => p.id),
      drifted: s.drifted,
    }
    console.log(asJson ? JSON.stringify(out, null, 2) : formatStatus(out))
    return s.drifted.length > 0 ? 1 : 0
  }

  const started = Date.now()
  try {
    const r = migrate(runner, MIGRATIONS_DIR)
    const ms = Date.now() - started
    if (asJson) {
      console.log(JSON.stringify({ engine: runner.engine, ...r, durationMs: ms }, null, 2))
    } else {
      console.log(`✓ migrations applied (${runner.engine}, ${ms} ms)`)
      for (const id of r.applied) console.log(`  + ${id}`)
      if (r.alreadyApplied.length > 0) {
        console.log(`  = ${r.alreadyApplied.length} already applied (idempotent)`)
      }
    }
    return 0
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`)
    return 1
  }
}

function formatStatus(s: {
  engine: string
  applied: string[]
  pending: string[]
  drifted: readonly unknown[]
}): string {
  const lines = [`engine: ${s.engine}`, `applied (${s.applied.length}):`]
  for (const id of s.applied) lines.push(`  ✓ ${id}`)
  lines.push(`pending (${s.pending.length}):`)
  for (const id of s.pending) lines.push(`  · ${id}`)
  if (s.drifted.length > 0) {
    lines.push(`DRIFT (${s.drifted.length}):`)
    for (const d of s.drifted) lines.push(`  ! ${JSON.stringify(d)}`)
  }
  return lines.join('\n')
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  process.exit(main())
}
