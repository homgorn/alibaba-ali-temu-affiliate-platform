/**
 * Schema inspection — proves the migrations produced what SPEC-003 §6 requires.
 *
 * This is a verification tool, not a test: it prints what is actually in the
 * database so a human can check it against the spec. Assertions live in
 * tests/integration/schema.test.ts.
 */

import { sqliteModule } from '../src/engine/db/sqlite-runner.ts'

interface Stmt {
  all(...p: unknown[]): unknown[]
}
interface DB {
  prepare(sql: string): Stmt
  exec(sql: string): void
}

const { DatabaseSync } = sqliteModule() as unknown as { DatabaseSync: new (p: string) => DB }

const db = new DatabaseSync(
  process.env.DATABASE_URL?.replace(/^file:/, '') ?? './data/dev.db',
)

const tables = (
  db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .all() as { name: string }[]
).map((r) => r.name)

console.log(`TABLES (${tables.length}):`)
for (const t of tables) console.log(`  ${t}`)

const idx = (
  db
    .prepare(`SELECT count(*) AS c FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`)
    .all() as { c: number }[]
)[0]!
console.log(`\ncustom indexes: ${idx.c}`)

const fk = db.prepare('PRAGMA foreign_key_check').all()
console.log(`FK violations: ${fk.length}`)

function cols(table: string): { name: string; type: string; notnull: number }[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string
    type: string
    notnull: number
  }[]
}

for (const t of ['price_observation', 'product', 'click_event']) {
  console.log(`\n${t}:`)
  for (const c of cols(t)) {
    console.log(`  ${c.name.padEnd(26)} ${c.type}${c.notnull ? ' NOT NULL' : ''}`)
  }
}

// Prove money is INTEGER everywhere it appears (SPEC-003 FR-3).
console.log('\nmoney column types (must all be INTEGER):')
let moneyViolations = 0
for (const t of tables) {
  for (const c of cols(t)) {
    if (/minor|amount/i.test(c.name)) {
      const bad = c.type !== 'INTEGER'
      if (bad) moneyViolations++
      console.log(`  ${t}.${c.name.padEnd(24)} ${c.type}${bad ? '  <-- NOT INTEGER' : ''}`)
    }
  }
}
console.log(`\nmoney violations: ${moneyViolations}`)
