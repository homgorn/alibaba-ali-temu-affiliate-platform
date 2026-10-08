/** Inspect the price series for the product whose price changed. */
import { createSqliteRunner } from '../../src/engine/db/sqlite-runner.ts'

const r = createSqliteRunner('file:./data/dev.db')

const q = (sql: string) => r.query(sql)

console.log('--- price series for external_product_id 33006951783 ---')
const rows = q(`
  SELECT po.observed_at, po.sale_price_minor, po.currency, po.source
  FROM price_observation po
  JOIN product p ON p.product_id = po.product_id
  WHERE p.external_product_id = '33006951783'
  ORDER BY po.observed_at
`)
for (const o of rows as { observed_at: string; sale_price_minor: number; currency: string; source: string }[]) {
  console.log(`  ${o.observed_at}  ${(o.sale_price_minor / 100).toFixed(2)} ${o.currency}  src=${o.source}`)
}
if (rows.length === 0) console.log('  (none)')

console.log('\n--- totals ---')
for (const label of ['price_observation', 'product', 'ingestion_run']) {
  const c = (q(`SELECT count(*) AS c FROM ${label}`) as { c: number }[])[0]!.c
  console.log(`  ${label.padEnd(18)} ${c}`)
}
const distinct = (q('SELECT count(DISTINCT observed_at) AS c FROM price_observation') as { c: number }[])[0]!.c
console.log(`  distinct observed_at ${distinct}`)

console.log('\n--- by observed_at ---')
for (const g of q('SELECT observed_at, count(*) AS c FROM price_observation GROUP BY 1 ORDER BY 1') as { observed_at: string; c: number }[]) {
  console.log(`  ${g.observed_at}  ${g.c}`)
}

r.close()
