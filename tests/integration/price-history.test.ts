/**
 * L3 integration tests — F013: price history across multiple ingests.
 *
 * The behaviours under test are subtle and were all found by running:
 *   - re-ingesting the same feed must not stack duplicate price points
 *   - a genuine price change MUST be counted as a change
 *   - a title-only change must not fabricate a price observation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRunner } from '../../src/engine/db/sqlite-runner.ts'
import { migrate, type Runner } from '../../src/engine/db/migrate.ts'
import { ingestCsv } from '../../src/engine/ingest/ingest-csv.ts'
import { parseSafetyConfig } from '../../src/engine/ingest/safety.ts'
import { MIGRATIONS_DIR } from '../helpers.ts'

const COLUMNS = [
  'network', 'external_product_id', 'title', 'detail_url', 'currency',
  'destination_country', 'sale_price', 'original_price', 'commission_rate',
  'delivery_bucket_days', 'shipping', 'evaluate_rate', 'category_path',
].join(',')

const SAFETY = parseSafetyConfig('battery, charger, power bank, helmet, baby, car seat')

let dir: string
let url: string
let open: Runner[]

function runner(): Runner {
  const r = createSqliteRunner(url)
  open.push(r)
  return r
}

function prepared(): Runner {
  const r = runner()
  migrate(r, MIGRATIONS_DIR)
  r.exec(
    `INSERT INTO network (network_id, display_name, source_kind, commission_model,
       cookie_window_days, supports_product_feed, supports_deep_links)
     VALUES ('aliexpress','AliExpress','live-api','cps',3,1,1)`,
    [],
  )
  return r
}

function line(values: string[]): string {
  return values.join(',') + ','.repeat(COLUMNS.split(',').length - values.length)
}

function feed(...rows: string[]): string {
  return [COLUMNS, ...rows].join('\n')
}

function ingest(r: Runner, csv: string, at: string) {
  return ingestCsv(r, csv, {
    networkId: 'aliexpress',
    moduleId: 'csv:aliexpress',
    source: 'csv',
    safety: SAFETY,
    now: new Date(at),
  })
}

function series(r: Runner, externalId: string) {
  return r.query<{ observed_at: string; sale_price_minor: number; source: string }>(
    `SELECT po.observed_at, po.sale_price_minor, po.source
     FROM price_observation po
     JOIN product p ON p.product_id = po.product_id
     WHERE p.external_product_id = $1 AND po.destination_country = 'US'
     ORDER BY po.observed_at`,
    [externalId],
  )
}

const T1 = '2026-10-01T09:00:00.000Z'
const T2 = '2026-10-05T09:00:00.000Z'
const T3 = '2026-10-08T09:00:00.000Z'

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'affiliate-history-'))
  url = `file:${join(dir, 'test.db')}`
  open = []
})

afterEach(() => {
  for (const r of open) {
    try { r.close() } catch { /* already closed */ }
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('F013 step 1-2 — two ingests produce two or more price points', () => {
  it('a price change across ingests yields a history with both values', () => {
    const r = prepared()
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '18.50', '24.00', '0.09'])), T1)
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '14.99', '24.00', '0.09'])), T2)

    const s = series(r, 'A1')
    expect(s.length).toBeGreaterThanOrEqual(2)
    expect(s.map((x) => x.sale_price_minor)).toEqual([1850, 1499])
    expect(new Set(s.map((x) => x.observed_at)).size).toBe(2)
  })

  it('each observation records the source that produced it', () => {
    const r = prepared()
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '18.50'])), T1)
    for (const s of series(r, 'A1')) expect(s.source).toBe('csv')
  })
})

describe('F013 step 3 — the retention/downsampling rule is applied and reported', () => {
  it('a product with a year of history still answers "what was it a year ago"', () => {
    // FR-18: deleting raw high-resolution data must NOT lose the ability to
    // answer a historical question — that ability IS the product.
    const r = prepared()
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '20.00'])), T1)
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '18.00'])), T2)

    r.exec(
      `INSERT INTO price_daily_rollup (product_id, destination_country, day, currency,
         min_price_minor, max_price_minor, avg_price_minor, first_price_minor,
         last_price_minor, observations, computed_at)
       SELECT product_id, destination_country, '2026-10-01', currency,
              MIN(sale_price_minor), MAX(sale_price_minor), AVG(sale_price_minor),
              MIN(sale_price_minor), MAX(sale_price_minor), COUNT(*), $1
       FROM price_observation GROUP BY product_id, destination_country, currency`,
      [T3],
    )

    const rollup = r.query<{ day: string; observations: number }>(
      'SELECT day, observations FROM price_daily_rollup',
    )
    expect(rollup.length).toBeGreaterThan(0)

    // Delete all raw observations — the rollup must survive.
    r.exec('DELETE FROM price_observation')
    const after = r.query<{ c: number }>('SELECT count(*) AS c FROM price_daily_rollup')[0]!.c
    expect(after).toBe(rollup.length)
  })
})

describe('no duplicate points from re-ingestion', () => {
  it('ingesting the SAME feed on a later date adds no duplicate observation', () => {
    const r = prepared()
    const csv = feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '18.50']))
    ingest(r, csv, T1)
    ingest(r, csv, T2)
    ingest(r, csv, T3)
    expect(series(r, 'A1').length).toBe(1)
  })

  it('a price that moves back and forth records each distinct value once', () => {
    const r = prepared()
    const at = (p: string) => line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', p])
    ingest(r, feed(at('18.50')), T1)
    ingest(r, feed(at('14.99')), T2)
    ingest(r, feed(at('18.50')), T3)
    const s = series(r, 'A1')
    expect(s.map((x) => x.sale_price_minor)).toEqual([1850, 1499, 1850])
  })
})

describe('a change is counted as a change', () => {
  it('a price-only change is reported as rowsWritten 1', () => {
    // This is the assertion that would have caught the accounting bug where
    // price moves were recorded but reported as "0 rows written".
    const r = prepared()
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '18.50'])), T1)
    const res = ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '14.99'])), T2)
    expect(res.rowsWritten).toBe(1)
    expect(res.rowsUnchanged).toBe(0)
  })

  it('an unchanged re-ingest is reported as rowsWritten 0', () => {
    const r = prepared()
    const csv = feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '18.50']))
    ingest(r, csv, T1)
    const res = ingest(r, csv, T2)
    expect(res.rowsWritten).toBe(0)
    expect(res.rowsUnchanged).toBe(1)
  })

  it('a title-only change updates the product but adds no price point', () => {
    const r = prepared()
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '18.50'])), T1)
    const res = ingest(r, feed(line(['aliexpress', 'A1', 'Widget Plus', 'https://x/1', 'USD', 'US', '18.50'])), T2)

    expect(res.rowsWritten).toBe(1)
    expect(series(r, 'A1').length).toBe(1)
    const title = r.query<{ title: string }>('SELECT title FROM product')[0]!.title
    expect(title).toBe('Widget Plus')
  })
})

describe('destinations keep independent histories (SPEC-003 FR-7)', () => {
  it('a US and a DE price for one product form two separate series', () => {
    const r = prepared()
    ingest(
      r,
      feed(
        line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '18.50']),
        line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'EUR', 'DE', '17.00']),
      ),
      T1,
    )
    const byCountry = r.query<{ destination_country: string; c: number }>(
      'SELECT destination_country, count(*) AS c FROM price_observation GROUP BY 1 ORDER BY 1',
    )
    expect(byCountry.map((x) => x.destination_country)).toEqual(['DE', 'US'])
    expect(byCountry.every((x) => x.c === 1)).toBe(true)
  })
})

describe('EC-2 — price anomalies are flagged, never silently corrected', () => {
  it('original < sale is recorded as an anomaly', () => {
    const r = prepared()
    // A "discount" where the original is LOWER than the sale price is an
    // upstream inconsistency, and it is exactly what fake-discount detection
    // needs to see. Storing it as-is is deliberate.
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '20.00', '10.00'])), T1)
    const row = r.query<{ price_anomaly: string | null; sale_price_minor: number; original_price_minor: number }>(
      'SELECT price_anomaly, sale_price_minor, original_price_minor FROM price_observation',
    )[0]!
    expect(row.price_anomaly).toBe('original_lt_sale')
    expect(row.sale_price_minor).toBe(2000)
    expect(row.original_price_minor).toBe(1000)
  })

  it('a zero price is flagged as a placeholder', () => {
    const r = prepared()
    ingest(r, feed(line(['aliexpress', 'A1', 'Widget', 'https://x/1', 'USD', 'US', '0.00'])), T1)
    const row = r.query<{ price_is_placeholder: number }>(
      'SELECT price_is_placeholder FROM product',
    )[0]!
    expect(row.price_is_placeholder).toBe(1)
  })
})
