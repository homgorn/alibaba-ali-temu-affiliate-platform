/**
 * L1 unit tests — pure functions.
 * SPEC-001 FR-7/NFR-8: these run with NO database and NO credentials.
 */

import { describe, it, expect } from 'vitest'
import { render, applyConditionals, checksum } from '../../src/engine/db/migrate.ts'
import { dialectFor, detectEngine } from '../../src/engine/db/dialect.ts'
import { toSqlitePlaceholders } from '../../src/engine/db/sqlite-runner.ts'

const SQLITE = dialectFor('sqlite')
const POSTGRES = dialectFor('postgres')

describe('dialect type mapping (SPEC-003 FR-1, FR-3)', () => {
  it('money is integer minor units on BOTH engines — never float', () => {
    expect(SQLITE.money).toBe('INTEGER')
    expect(POSTGRES.money).toBe('BIGINT')
    // Neither may ever be a floating-point type.
    expect(SQLITE.money).not.toMatch(/REAL|FLOAT|DOUBLE|NUMERIC/)
    expect(POSTGRES.money).not.toMatch(/REAL|FLOAT|DOUBLE|NUMERIC$/)
  })

  it('uuid is portable text', () => {
    expect(SQLITE.uuid).toBe('TEXT')
    expect(POSTGRES.uuid).toBe('TEXT')
  })

  it('rate is exact on postgres and approximate on sqlite', () => {
    expect(POSTGRES.rate).toBe('NUMERIC(6,5)')
    expect(SQLITE.rate).toBe('REAL')
  })
})

describe('detectEngine', () => {
  it('recognises sqlite forms', () => {
    expect(detectEngine('file:./data/dev.db')).toBe('sqlite')
    expect(detectEngine('./data/dev.db')).toBe('sqlite')
    expect(detectEngine('x.sqlite')).toBe('sqlite')
  })

  it('recognises postgres forms', () => {
    expect(detectEngine('postgres://u:p@h/db')).toBe('postgres')
    expect(detectEngine('postgresql://u:p@h/db')).toBe('postgres')
  })

  it('refuses to guess an unknown URL rather than picking a schema for the wrong DB', () => {
    expect(() => detectEngine('mysql://u:p@h/db')).toThrow(/Cannot determine/)
  })
})

describe('render() type substitution', () => {
  it('substitutes case-insensitively — migrations write @{TEXT}, fields are camelCase', () => {
    // This was a real bug caught by running the migration, not by reading it.
    expect(render('a @{TEXT} b', SQLITE)).toBe('a TEXT b')
    expect(render('a @{text} b', SQLITE)).toBe('a TEXT b')
    expect(render('a @{MONEY} b', SQLITE)).toBe('a INTEGER b')
    expect(render('a @{MONEY} b', POSTGRES)).toBe('a BIGINT b')
  })

  it('throws a helpful error on an unknown token, listing the valid ones', () => {
    expect(() => render('@{NOPE}', SQLITE)).toThrow(/Unknown type token @\{NOPE\}/)
    expect(() => render('@{NOPE}', SQLITE)).toThrow(/Known tokens/)
  })

  it('substitutes every occurrence', () => {
    expect(render('@{TEXT} @{TEXT} @{TEXT}', SQLITE)).toBe('TEXT TEXT TEXT')
  })
})

describe('applyConditionals() (SPEC-003 FR-2 — engine guards)', () => {
  it('keeps the block matching the engine and drops the other', () => {
    const sql = [
      '-- @if:postgres',
      'PG_ONLY;',
      '-- @else',
      'SQLITE_ONLY;',
      '-- @endif',
    ].join('\n')
    expect(applyConditionals(sql, 'postgres')).toContain('PG_ONLY')
    expect(applyConditionals(sql, 'postgres')).not.toContain('SQLITE_ONLY')
    expect(applyConditionals(sql, 'sqlite')).toContain('SQLITE_ONLY')
    expect(applyConditionals(sql, 'sqlite')).not.toContain('PG_ONLY')
  })

  it('throws on an unterminated block rather than guessing', () => {
    expect(() => applyConditionals('-- @if:postgres\nSELECT 1;', 'sqlite')).toThrow(
      /Unterminated/,
    )
  })

  it('throws on @else without @if', () => {
    expect(() => applyConditionals('-- @else\nSELECT 1;\n-- @endif', 'sqlite')).toThrow(
      /@else without @if/,
    )
  })
})

describe('toSqlitePlaceholders()', () => {
  it('converts $N to the numbered ?NNN form', () => {
    // Numbered, not bare `?`: SQLite's `?` binds positionally, so a placeholder
    // repeated twice would consume two params and shift every later binding.
    // Postgres allows `$10` to repeat; `?10` is the exact equivalent.
    expect(toSqlitePlaceholders('VALUES ($1, $2)')).toBe('VALUES (?1, ?2)')
  })

  it('handles multi-digit placeholders without truncating them', () => {
    expect(toSqlitePlaceholders('VALUES ($10, $11)')).toBe('VALUES (?10, ?11)')
  })

  it('a REPEATED placeholder binds the same value, not two', () => {
    // The bug this guards: `first_seen_at = $10, last_seen_at = $10` must not
    // shift bindings for $11..$14.
    const sql = 'INSERT INTO t VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11)'
    const out = toSqlitePlaceholders(sql)
    expect(out).toBe('INSERT INTO t VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10,?11)')
    expect((out.match(/\?10/g) ?? []).length).toBe(2)
    expect(out).toContain('?11')
  })

  it('leaves string literals untouched — a naive regex would corrupt these', () => {
    expect(toSqlitePlaceholders(`SELECT 'cost $1 only' FROM t WHERE x = $2`)).toBe(
      `SELECT 'cost $1 only' FROM t WHERE x = ?2`,
    )
  })

  it('handles escaped quotes inside literals', () => {
    expect(toSqlitePlaceholders(`SELECT 'it''s $1' , $2`)).toBe(`SELECT 'it''s $1' , ?2`)
  })

  it('does not treat $0 or $ followed by a letter as a placeholder', () => {
    expect(toSqlitePlaceholders('SELECT $name, $0')).toBe('SELECT $name, $0')
  })

  it('handles multiple distinct placeholders correctly', () => {
    expect(toSqlitePlaceholders('INSERT INTO t VALUES ($1,$2,$3)')).toBe(
      'INSERT INTO t VALUES (?1,?2,?3)',
    )
  })
})

describe('checksum()', () => {
  it('is stable for identical input', () => {
    expect(checksum('SELECT 1')).toBe(checksum('SELECT 1'))
  })

  it('changes when the SQL changes — this is what detects migration drift', () => {
    expect(checksum('SELECT 1')).not.toBe(checksum('SELECT 2'))
  })
})
