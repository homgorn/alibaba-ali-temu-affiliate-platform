/** Find the exact failing statement by running ingest against a 1-row CSV. */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRunner } from '../../src/engine/db/sqlite-runner.ts'
import { migrate } from '../../src/engine/db/migrate.ts'
import { ingestCsv } from '../../src/engine/ingest/ingest-csv.ts'
import { parseSafetyConfig } from '../../src/engine/ingest/safety.ts'

const dir = mkdtempSync(join(tmpdir(), 'probe5-'))
const r = createSqliteRunner(`file:${join(dir, 'p.db')}`)
migrate(r, join(process.cwd(), 'db', 'migrations'))
r.exec(
  `INSERT INTO network (network_id, display_name, source_kind, commission_model, cookie_window_days, supports_product_feed, supports_deep_links)
   VALUES ('aliexpress','AliExpress','live-api','cps',3,1,1)`,
  [],
)

// Take header + first 3 data rows from the real fixture.
const full = readFileSync('tests/fixtures/products.csv', 'utf8').split('\n')
const small = full.slice(0, 4).join('\n')

try {
  const res = ingestCsv(r, small, {
    networkId: 'aliexpress',
    moduleId: 'csv:aliexpress',
    source: 'csv',
    safety: parseSafetyConfig('battery,charger,ppe,helmet,baby,infant'),
    now: new Date('2026-10-08T12:00:00.000Z'),
  })
  console.log('3-row ingest OK:', JSON.stringify(res, null, 1))
} catch (e) {
  console.log('FAILED:', (e as Error).message)
  console.log((e as Error).stack?.split('\n').slice(0, 6).join('\n'))
}
r.close()
