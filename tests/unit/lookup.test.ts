import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRunner } from '../../src/engine/db/sqlite-runner.ts'
import { migrate, type Runner } from '../../src/engine/db/migrate.ts'
import { searchProducts, parseLookupUrl, LookupInputError } from '../../src/engine/api/lookup.ts'
import { MIGRATIONS_DIR } from '../helpers.ts'

const COLUMNS = [
  'network', 'external_product_id', 'title', 'detail_url', 'currency',
  'destination_country', 'sale_price', 'original_price', 'commission_rate',
  'delivery_bucket_days', 'shipping', 'evaluate_rate', 'category_path',
].join(',')

let dir: string
let url: string
let open: Runner[]

function runner(): Runner {
  const r = createSqliteRunner(url)
  open.push(r)
  return r
}

let r: Runner
function prepareDb() {
  r = runner()
  migrate(r, MIGRATIONS_DIR)
  r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model, cookie_window_days, supports_product_feed, supports_deep_links)
          VALUES ('aliexpress','AliExpress','live-api','cps',3,1,1)`, [])
  const seed = [
    ['33006951782', 'Spring mother daughter dress', 'Womens Clothing & Accessories>Dresses', 'USD', 'US', '12.99'],
    ['33006951783', 'Wireless Bluetooth Earbuds', 'Electronics>Headphones', 'USD', 'US', '18.50'],
    ['33006951805', 'Wireless Charging Pad Qi', 'Electronics>Accessories', 'USD', 'US', '8.90'],
    ['33006951840', 'Wireless Charger Stand Qi', 'Electronics>Accessories', 'USD', 'DE', '13.40'],
  ]
  for (const [ext, title, catpath, cur, dest, price] of seed as [string, string, string, string, string, string][]) {
    const row = ['aliexpress', ext, title, `https://x/${ext}`, cur, dest, price, '', '0.08', '7', '1.00', '4.5', catpath].join(',')
    r.exec(
      `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url, category_path,
         commission_rate, monetisable, safety_excluded, first_seen_at, last_seen_at, source)
       VALUES ('${ext}','aliexpress','${ext}','${title.replace(/'/g, "''")}','https://x/${ext}','${catpath}',
         0.08,1,0,'2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','csv')`,
      [],
    )
    r.exec(
      `INSERT INTO price_observation (observation_id, product_id, destination_country, observed_at, currency, sale_price_minor, is_complete, source)
       VALUES ('o${ext}','${ext}','${dest}','2026-10-08T00:00:00.000Z','${cur}',${Math.round(Number(price)*100)},1,'csv')`,
      [],
    )
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lookup-'))
  url = `file:${join(dir, 't.db')}`
  open = []
})

afterEach(() => {
  for (const rr of open) { try { rr.close() } catch { /* */ } }
  rmSync(dir, { recursive: true, force: true })
})

describe('parseLookupUrl validation (F014 step 5)', () => {
  it('rejects a malformed limit with a clear reason', () => {
    expect(() => parseLookupUrl(new URL('http://x/products?limit=abc'))).toThrow(/limit must/)
  })
  it('rejects a malformed currency', () => {
    expect(() => parseLookupUrl(new URL('http://x/products?currency=US'))).toThrow(/currency/)
  })
  it('accepts a clean query', () => {
    const q = parseLookupUrl(new URL('http://x/products?q=battery&category=Chargers&currency=USD'))
    expect(q.currency).toBe('USD')
    expect(q.limit).toBe(50)
  })
})

describe('searchProducts (F014 steps 2-4)', () => {
  beforeEach(prepareDb)

  it('free-text matches a product', () => {
    const res = searchProducts(r, { q: 'mother' })
    expect(res.length).toBe(1)
    expect(res[0]!.title).toContain('mother')
  })

  it('category filter returns only that category', () => {
    const res = searchProducts(r, { category: 'Electronics>Accessories' })
    expect(res.length).toBe(2)
    for (const p of res) expect(p.title).not.toBe('Wireless Bluetooth Earbuds')
  })

  it('a term matching nothing returns [] (not an error)', () => {
    const res = searchProducts(r, { q: 'zzz-no-such-thing' })
    expect(res).toEqual([])
  })

  it('returns currency/destination of the observation', () => {
    const res = searchProducts(r, { q: 'Charger Stand' })
    expect(res[0]!.currency).toBe('USD')
    expect(res[0]!.destinationCountry).toBe('DE')
  })
})
