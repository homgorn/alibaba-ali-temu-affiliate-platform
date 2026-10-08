/** Diagnostic probe — explains the integration test failures. */
import { createSqliteRunner } from '../src/engine/db/sqlite-runner.ts'
import { migrate } from '../src/engine/db/migrate.ts'

const r = createSqliteRunner('file:./data/probe.db')
migrate(r, './db/migrations')

console.log('--- network insert with live-api ---')
try {
  r.exec(
    `INSERT INTO network (network_id, display_name, source_kind, commission_model)
     VALUES ($1,$2,$3,$4)`,
    ['ae', 'AliExpress', 'live-api', 'cps'],
  )
  console.log('OK with params')
} catch (e) {
  console.log('FAILED with params:', (e as Error).message)
}

try {
  r.exec(
    `INSERT INTO network (network_id, display_name, source_kind, commission_model)
     VALUES ('ae2','X','live-api','cps')`,
  )
  console.log('OK literal, no params')
} catch (e) {
  console.log('FAILED literal:', (e as Error).message)
}

console.log('\n--- pragma table_info(network) ---')
console.log(JSON.stringify(r.query('PRAGMA table_info(network)'), null, 1))

console.log('\n--- sqlite_master sql for network ---')
const m = r.query<{ sql: string }>(
  `SELECT sql FROM sqlite_master WHERE type='table' AND name='network'`,
)
console.log(m[0]?.sql)
