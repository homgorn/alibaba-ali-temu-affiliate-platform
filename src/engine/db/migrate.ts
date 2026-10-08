/**
 * Migration runner — SPEC-003 FR-1, AC-1, AC-2, AC-3, NFR-4, NFR-5.
 *
 * Design notes that matter:
 *
 *  - Migrations are the ONLY schema authority. db/schema/schema.sql is
 *    generated documentation, never the source.
 *
 *  - Idempotency (AC-3): every migration runs inside a transaction and is
 *    recorded in _migrations. Re-running applies nothing (NFR-5).
 *
 *  - Portability (FR-1): migration SQL uses logical type tokens that are
 *    substituted per engine. An engine-specific block must be wrapped in
 *    `IF ENGINE = ...` markers so it is visible in review rather than hidden.
 *
 *  - EC-12: on failure the schema must be left so prior migrations still apply.
 *    Transactional DDL where the engine supports it; where it does not, we
 *    record the failure and stop rather than continuing in an unknown state.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Dialect } from './dialect.ts'
import { dialectFor } from './dialect.ts'

export interface MigrationFile {
  readonly id: string
  readonly filename: string
  readonly sql: string
}

export interface AppliedMigration {
  readonly id: string
  readonly filename: string
  readonly appliedAt: string
  readonly checksum: string
}

export interface Runner {
  readonly engine: Dialect['engine']
  /** Execute DDL/DML. `params` uses $1,$2 on postgres and ? on sqlite. */
  exec(sql: string, params?: readonly unknown[]): void
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): T[]
  begin(): void
  commit(): void
  rollback(): void
  /**
   * Release the connection. Required on Windows: with WAL enabled, SQLite holds
   * a file lock, so the .db/.db-wal/.db-shm files cannot be deleted until the
   * handle is closed. Tests that create and delete temp databases fail with
   * EBUSY without this.
   */
  close(): void
}

export interface MigrationDrift {
  readonly id: string
  readonly expected: string
  readonly actual: string
}

export interface MigrationStatus {
  readonly applied: readonly AppliedMigration[]
  readonly pending: readonly MigrationFile[]
  readonly drifted: readonly MigrationDrift[]
}

/** Stable checksum — FNV-1a, 32-bit hex. Enough to catch edits, not a security hash. */
export function checksum(sql: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < sql.length; i++) {
    h ^= sql.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export function loadMigrations(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort() // zero-padded numeric prefix => lexicographic == numeric
    .map((filename) => {
      const id = filename.replace(/\.sql$/, '')
      return { id, filename, sql: readFileSync(join(dir, filename), 'utf8') }
    })
}

/**
 * Substitute logical type tokens for the concrete engine.
 *
 * Migration authors write e.g. `price_minor @{MONEY} NOT NULL`. Using an
 * explicit `@{...}` sigil rather than bare words means a type name can never
 * collide with a column called `text` or `json`.
 */
export function render(sql: string, d: Dialect): string {
  // Keys are matched case-insensitively: migrations write @{TEXT} (SQL
  // convention) while the Dialect fields are camelCase.
  const map: Record<string, string> = {
    uuid: d.uuid,
    timestamp: d.timestamp,
    json: d.json,
    money: d.money,
    rate: d.rate,
    boolean: d.boolean,
    text: d.text,
    int: d.int,
    bigint: d.bigint,
  }
  return sql.replace(/@\{(\w+)\}/g, (whole, key: string) => {
    const v = map[key.toLowerCase()]
    if (v === undefined) {
      const known = Object.keys(map).join(', ')
      throw new Error(
        `Unknown type token ${whole}. Known tokens: ${known}. ` +
          `Add it to src/engine/db/dialect.ts if it is genuinely new.`,
      )
    }
    return v
  })
}

/**
 * Extract engine-guarded blocks.
 *   -- @if:postgres
 *   ...sql...
 *   -- @endif
 * A block for a non-matching engine is dropped; @else is also supported.
 */
export function applyConditionals(sql: string, engine: Dialect['engine']): string {
  const lines = sql.split('\n')
  const out: string[] = []
  let active: boolean | null = null
  let inElse = false

  for (const line of lines) {
    const ifMatch = line.match(/^\s*--\s*@if:(\w+)/)
    if (ifMatch) {
      active = ifMatch[1] === engine
      inElse = false
      continue
    }
    if (/^\s*--\s*@else\s*$/.test(line)) {
      if (active === null) throw new Error('@else without @if')
      active = !active
      inElse = true
      continue
    }
    if (/^\s*--\s*@endif\s*$/.test(line)) {
      active = null
      inElse = false
      continue
    }
    if (active === null || active) out.push(line)
  }
  if (active !== null) throw new Error('Unterminated @if block')
  void inElse
  return out.join('\n')
}

export const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id          @{TEXT} PRIMARY KEY,
  filename    @{TEXT} NOT NULL,
  applied_at  @{TIMESTAMP} NOT NULL,
  checksum    @{TEXT} NOT NULL
);
`

export function status(runner: Runner, migrationsDir: string): MigrationStatus {
  const files = loadMigrations(migrationsDir)
  let appliedRows: AppliedMigration[] = []
  try {
    appliedRows = runner.query<AppliedMigration>(
      'SELECT id, filename, applied_at, checksum FROM _migrations ORDER BY id',
    )
  } catch {
    // Table absent => nothing applied yet (AC-1 fresh checkout).
  }

  const appliedById = new Map(appliedRows.map((a) => [a.id, a]))
  const applied = appliedRows
  const pending = files.filter((f) => !appliedById.has(f.id))

  // Drift detection: an already-applied migration whose file has since been
  // edited. Never silently re-run — that could corrupt data.
  const drifted: MigrationDrift[] = []
  for (const f of files) {
    const a = appliedById.get(f.id)
    if (a && a.checksum !== checksum(f.sql)) {
      drifted.push({ id: f.id, expected: a.checksum, actual: checksum(f.sql) })
    }
  }

  return { applied, pending, drifted }
}

export interface MigrationResult {
  readonly applied: string[]
  readonly alreadyApplied: string[]
  readonly drifted: readonly MigrationDrift[]
}

export function migrate(runner: Runner, migrationsDir: string): MigrationResult {
  const d = dialectFor(runner.engine)
  const s = status(runner, migrationsDir)

  if (s.drifted.length > 0) {
    throw new Error(
      `Migration drift detected. An applied migration file has been modified:\n` +
        s.drifted.map((x) => `  ${x.id}: on-disk ${x.actual} != applied ${x.expected}`).join('\n') +
        `\n\nRefusing to run. Create a NEW migration instead of editing an applied one.\n` +
        `(Deleting the row from _migrations to force re-apply would be a destructive\n` +
        `action and requires operator confirmation — see AGENTS.md R1.)`,
    )
  }

  runner.exec(render(MIGRATIONS_TABLE_SQL, d))

  const appliedNow: string[] = []
  for (const m of s.pending) {
    const sql = render(applyConditionals(m.sql, runner.engine), d)
    runner.begin()
    try {
      runner.exec(sql)
      runner.exec(
        `INSERT INTO _migrations (id, filename, applied_at, checksum) VALUES ($1, $2, $3, $4)`,
        [m.id, m.filename, new Date().toISOString(), checksum(m.sql)],
      )
      runner.commit()
      appliedNow.push(m.id)
    } catch (err) {
      runner.rollback()
      // EC-12: stop cleanly, leave prior migrations intact.
      throw new Error(
        `Migration ${m.id} failed: ${(err as Error).message}\n` +
          `Rolled back. Schema is unchanged for migrations before ${m.id}.`,
      )
    }
  }

  return {
    applied: appliedNow,
    alreadyApplied: s.applied.map((a) => a.id),
    drifted: s.drifted,
  }
}
