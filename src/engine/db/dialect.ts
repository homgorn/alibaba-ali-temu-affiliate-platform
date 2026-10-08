/**
 * Portable SQL dialect for SQLite (dev) and Postgres (prod).
 *
 * SPEC-003 FR-1/FR-2: one schema, one set of migration files, no per-engine
 * forks except explicitly marked optional sections.
 *
 * The strategy is a tiny vocabulary of logical types that each engine maps to
 * its own physical type. Migrations are written against the LOGICAL names.
 */

export type Engine = 'sqlite' | 'postgres'

export interface Dialect {
  readonly engine: Engine
  /** UUID — portable as TEXT everywhere (SPEC-003 §6 type mapping). */
  readonly uuid: string
  /** SQLite has no native tz type; ISO-8601 UTC text is the portable form. */
  readonly timestamp: string
  readonly json: string
  /** Money is INTEGER minor units in BOTH engines. Never float (SPEC-003 FR-3). */
  readonly money: string
  /** Rate 0..1. Postgres gets NUMERIC for exactness; SQLite gets REAL. */
  readonly rate: string
  readonly boolean: string
  readonly text: string
  readonly int: string
  readonly bigint: string
}

const SQLITE: Dialect = {
  engine: 'sqlite',
  uuid: 'TEXT',
  timestamp: 'TEXT',
  json: 'TEXT',
  money: 'INTEGER',
  rate: 'REAL',
  boolean: 'INTEGER',
  text: 'TEXT',
  int: 'INTEGER',
  bigint: 'INTEGER',
}

const POSTGRES: Dialect = {
  engine: 'postgres',
  uuid: 'TEXT',
  timestamp: 'TIMESTAMPTZ',
  json: 'JSONB',
  money: 'BIGINT',
  rate: 'NUMERIC(6,5)',
  boolean: 'BOOLEAN',
  text: 'TEXT',
  int: 'INTEGER',
  bigint: 'BIGINT',
}

export function dialectFor(engine: Engine): Dialect {
  return engine === 'postgres' ? POSTGRES : SQLITE
}

/**
 * Detect the engine from a connection URL.
 * Anything not explicitly postgres/sqlite is a hard error — guessing would
 * produce a schema for the wrong database (SPEC-003 AC-1/AC-2).
 */
export function detectEngine(url: string): Engine {
  if (url.startsWith('file:') || url.endsWith('.db') || url.endsWith('.sqlite')) {
    return 'sqlite'
  }
  if (/^postgres(ql)?:\/\//i.test(url)) return 'postgres'
  throw new Error(
    `Cannot determine database engine from DATABASE_URL. ` +
      `Expected 'file:...', '*.db', or 'postgres://'. Got: ${url.slice(0, 40)}`,
  )
}
