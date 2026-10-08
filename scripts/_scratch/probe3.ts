/**
 * Diagnose the placeholder/param issue on the ingest INSERT.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRunner } from '../../src/engine/db/sqlite-runner.ts'
import { migrate } from '../../src/engine/db/migrate.ts'
import { parseCsvWithSchema } from '../../src/engine/ingest/csv.ts'
import { parseSafetyConfig } from '../../src/engine/ingest/safety.ts'
import { ingestCsv } from '../../src/engine/ingest/ingest-csv.ts'
import { readFileSync } from 'node:fs'

const dir = mkdtempSync(join(tmpdir(), 'probe3-'))
const r = createSqliteRunner(`file:${join(dir, 'p.db')}`)
migrate(r, join(process.cwd(), 'db', 'migrations'))
r.exec(
  `INSERT INTO network (network_id, display_name, source_kind, commission_model, cookie_window_days, supports_product_feed, supports_deep_links)
   VALUES ('aliexpress','AliExpress','live-api','cps',3,1,1)`,
  [],
)

const csv = readFileSync('tests/fixtures/products.csv', 'utf8')
const rows = parseCsvWithSchema(csv, {
  required: ['network', 'external_product_id', 'title', 'detail_url', 'currency', 'destination_country', 'sale_price'],
})
console.log('parsed rows:', rows.length)
console.log('first row keys:', Object.keys(rows[0]!).join(', '))

// Which specific statement fails? Try the product upsert with 14 params.
try {
  r.begin()
  r.exec(
    `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
       image_url, video_url, commission_rate, monetisable, safety_excluded,
       first_seen_at, last_seen_at, source, source_run_id, evaluate_rate, price_is_placeholder)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$10,$11,$12,$13,$14)`,
    ['id-1', 'aliexpress', 'ext-1', 'T', 'https://x/1', null, null, 0.08, 1, 'now', 'csv', 'run-1', 4.5, 0],
  )
  r.commit()
  console.log('product upsert: OK with 13 params (note $10 reused)')
} catch (e) {
  console.log('product upsert FAILED:', (e as Error).message)
  r.rollback()
}

try {
  r.begin()
  r.exec(
    `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
       image_url, video_url, commission_rate, monetisable, safety_excluded,
       first_seen_at, last_seen_at, source, source_run_id, evaluate_rate, price_is_placeholder)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15)`,
    ['id-1', 'aliexpress', 'ext-1', 'T', 'https://x/1', null, null, 0.08, 1, 'now', 'now', 'csv', 'run-1', 4.5, 0],
  )
  r.commit()
  console.log('product upsert with 15 distinct params: OK')
} catch (e) {
  console.log('product upsert 15 params FAILED:', (e as Error).message)
  r.rollback()
}

r.close()
