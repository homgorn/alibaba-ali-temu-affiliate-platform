/** Diagnostic probe 2 — isolate the empty-params multi-statement path. */
import { createSqliteRunner } from '../src/engine/db/sqlite-runner.ts'
import { migrate } from '../src/engine/db/migrate.ts'

const r = createSqliteRunner('file:./data/probe2.db')
migrate(r, './db/migrations')

console.log('A) exec(sql) with NO second arg, single statement:')
try {
  r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
          VALUES ('a','A','live-api','cps')`)
  console.log('   OK')
} catch (e) { console.log('   FAILED:', (e as Error).message) }

console.log('B) exec(sql, []) empty array, single statement:')
try {
  r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
          VALUES ('b','B','live-api','cps')`, [])
  console.log('   OK')
} catch (e) { console.log('   FAILED:', (e as Error).message) }

console.log('C) exec(sql, []) empty array, statement ending in a comment:')
try {
  r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
          VALUES ('c','C','live-api','cps')
          -- trailing comment`, [])
  console.log('   OK')
} catch (e) { console.log('   FAILED:', (e as Error).message) }

console.log('\nD) the exact failing test statement (has a trailing comment + newline):')
try {
  r.exec(
    `INSERT INTO ingestion_run (run_id, module_id, network_id, source_kind, started_at)
     VALUES ('run1','m1','a','csv','2026-10-08T00:00:00.000Z')`,
    [],
  )
  console.log('   OK')
} catch (e) { console.log('   FAILED:', (e as Error).message) }
