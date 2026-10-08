/**
 * SQLite runner — dev default (D-005 / ADR-003).
 *
 * Uses Node 22's BUILT-IN `node:sqlite`, not better-sqlite3. That removes the
 * only native dependency in the project: no prebuilt binary, no node-gyp
 * compile, no pnpm build-script approval, and no coupling to a native addon.
 *
 * Placeholders: migration SQL is written with $1,$2 (Postgres style) so the
 * SAME text runs on both engines (SPEC-003 FR-1). This adapter rewrites them
 * to SQLite's ? style.
 */

import { createRequire } from 'node:module'
import type { Runner } from './migrate.ts'

/**
 * Loaded lazily via createRequire rather than a static import.
 *
 * A static `import { DatabaseSync } from 'node:sqlite'` is rewritten by bundlers
 * and test runners (Vite/Vitest) into a bare `sqlite` specifier, which then
 * fails to resolve because node:sqlite is a BUILT-IN with no file on disk.
 * createRequire bypasses the resolver and hands us Node's own module.
 *
 * node:sqlite is also still marked experimental in Node 22, so isolating it
 * here means an API change touches this one adapter and nothing else.
 */
interface SqliteStatement {
  run(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

interface SqliteDatabase {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
  close(): void
}

type SqliteModule = { DatabaseSync: new (path: string) => SqliteDatabase }

let cached: SqliteModule | null = null

export function sqliteModule(): SqliteModule {
  if (cached) return cached
  const require = createRequire(import.meta.url)
  try {
    cached = require('node:sqlite') as SqliteModule
  } catch (err) {
    throw new Error(
      `node:sqlite is unavailable — it requires Node >= 22.5.\n` +
        `Current: ${process.version}\n` +
        `Original error: ${(err as Error).message}`,
    )
  }
  return cached
}

/**
 * Rewrite $1,$2... to ?,? while leaving string literals and identifiers alone.
 * A naive regex would corrupt any text containing '$1' inside a quoted string.
 */
export function toSqlitePlaceholders(sql: string): string {
  let out = ''
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]!

    if (ch === "'") {
      const start = i
      i++
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2 // escaped quote inside the literal
          } else {
            i++
            break
          }
        } else {
          i++
        }
      }
      out += sql.slice(start, i)
      continue
    }

    if (ch === '$' && /[1-9]/.test(sql[i + 1] ?? '')) {
      out += '?'
      i += 2
      continue
    }

    out += ch
    i++
  }
  return out
}

/** node:sqlite rejects undefined and has no boolean type. */
function toParam(p: unknown): null | number | bigint | string {
  if (p === undefined || p === null) return null
  if (typeof p === 'boolean') return p ? 1 : 0
  if (p instanceof Date) return p.toISOString()
  if (typeof p === 'object') return JSON.stringify(p)
  return p as number | bigint | string
}

export function createSqliteRunner(url: string): Runner {
  const path = url.replace(/^file:/, '')
  const { DatabaseSync } = sqliteModule()
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  return {
    engine: 'sqlite',

    exec(sql: string, params?: readonly unknown[]) {
      const bound = toSqlitePlaceholders(sql)
      if (params && params.length > 0) {
        db.prepare(bound).run(...params.map(toParam))
      } else {
        db.exec(bound)
      }
    },

    query<T>(sql: string, params?: readonly unknown[]): T[] {
      const bound = toSqlitePlaceholders(sql)
      const stmt = db.prepare(bound)
      if (params && params.length > 0) {
        return stmt.all(...params.map(toParam)) as T[]
      }
      return stmt.all() as T[]
    },

    begin() {
      db.exec('BEGIN')
    },

    commit() {
      db.exec('COMMIT')
    },

    rollback() {
      try {
        db.exec('ROLLBACK')
      } catch {
        // No active transaction — already rolled back.
      }
    },

    close() {
      db.close()
    },
  }
}
