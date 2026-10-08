/** Count placeholders vs params in the product upsert. */
const sql = `INSERT INTO product (
     product_id, network_id, external_product_id, title, detail_url,
     image_url, video_url, commission_rate, monetisable, safety_excluded,
     first_seen_at, last_seen_at, source, source_run_id, evaluate_rate,
     price_is_placeholder
   ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15)`

const used = new Set<number>()
for (const m of sql.matchAll(/\$(\d+)/g)) used.add(Number(m[1]))
const highest = Math.max(...used)
const params = ['id-1','aliexpress','ext-1','T','https://x/1',null,null,0.08,1,'now','now','csv','run-1',4.5,0]

console.log('distinct placeholders used:', [...used].sort((a,b)=>a-b).join(','))
console.log('highest placeholder:', highest)
console.log('params supplied     :', params.length)
console.log('MISMATCH:', highest !== params.length ? 'highest=$'+highest+' vs params='+params.length : 'none')

// Also count the real ingest file's statements.
import { readFileSync } from 'node:fs'
const src = readFileSync('src/engine/ingest/ingest-csv.ts', 'utf8')
const blocks = src.match(/INSERT INTO [a-z_]+ \([\s\S]*?\)[^;]*?;/g) ?? []
console.log('\n--- INSERT statements in ingest-csv.ts ---')
for (const b of blocks) {
  const table = b.match(/INSERT INTO (\w+)/)![1]
  const placeholders = [...b.matchAll(/\$(\d+)/g)].map(m => Number(m[1]))
  const hi = placeholders.length ? Math.max(...placeholders) : 0
  // find the params array following this statement
  const after = src.slice(src.indexOf(b) + b.length)
  const arr = after.match(/\[\s*([\s\S]*?)\n(\s*)\]/)
  let count = -1
  if (arr) {
    // crude but adequate: count top-level commas
    const body = arr[1]!
    let depth = 0, n = body.trim() === '' ? 0 : 1
    for (const ch of body) {
      if ('([{'.includes(ch)) depth++
      else if (')]}'.includes(ch)) depth--
      else if (ch === ',' && depth === 0) n++
    }
    count = n
  }
  console.log(`${table.padEnd(18)} max=$${String(hi).padEnd(4)} params=${count} ${hi===count?'ok':'  <-- MISMATCH'}`)
}
