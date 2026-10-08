/**
 * L3 integration tests — CSV ingestion end to end against a real database.
 *
 * Covers F012 and the SPEC-001 requirements that need a database to prove:
 * idempotency, whole-batch rejection, the safety gate, and provenance.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRunner } from '../../src/engine/db/sqlite-runner.ts'
import { migrate, type Runner } from '../../src/engine/db/migrate.ts'
import { ingestCsv, IngestError } from '../../src/engine/ingest/ingest-csv.ts'
import { parseSafetyConfig } from '../../src/engine/ingest/safety.ts'
import { REQUIRED_CSV_COLUMNS } from '../../src/engine/ingest/ingest-csv.ts'
import { MIGRATIONS_DIR, ROOT } from '../helpers.ts'

const FIXTURE = join(ROOT, 'tests/fixtures/products.csv')

const SAFETY = parseSafetyConfig(
  'battery, charger, power bank, powerbank, lithium, ppe, helmet, glove, baby, infant, car seat, stroller',
)

let dir: string
let url: string
let open: Runner[]

function runner(): Runner {
  const r = createSqliteRunner(url)
  open.push(r)
  return r
}

/** Fresh DB with migrations + the aliexpress network registered. */
/**
 * Header for the FULL fixture column set, so optional columns can be supplied.
 *
 * Optional columns are still declared, because a CSV row must have the same
 * field count as the header. `row()` below pads a short row automatically.
 */
const FULL_COLUMNS = [
  'network', 'external_product_id', 'title', 'detail_url', 'currency',
  'destination_country', 'sale_price', 'original_price', 'commission_rate',
  'delivery_bucket_days', 'shipping', 'evaluate_rate', 'category_path',
] as const

const FULL_HEADER = FULL_COLUMNS.join(',')

/**
 * Build a CSV line from the first N values, padding to the full column count.
 * Empty trailing values mean "unknown" — which is what we want to exercise.
 */
function row(...values: string[]): string {
  if (values.length > FULL_COLUMNS.length) {
    throw new Error(`row() got ${values.length} values, max ${FULL_COLUMNS.length}`)
  }
  return values.join(',') + ','.repeat(FULL_COLUMNS.length - values.length)
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

function ingest(r: Runner, csv: string, now = '2026-10-08T12:00:00.000Z') {
  return ingestCsv(r, csv, {
    networkId: 'aliexpress',
    moduleId: 'csv:aliexpress',
    source: 'csv',
    safety: SAFETY,
    now: new Date(now),
  })
}

function count(r: Runner, table: string): number {
  return r.query<{ c: number }>(`SELECT count(*) AS c FROM ${table}`)[0]!.c
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'affiliate-ingest-'))
  url = `file:${join(dir, 'test.db')}`
  open = []
})

afterEach(() => {
  for (const r of open) {
    try {
      r.close()
    } catch { /* already closed */ }
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('F012 — the shipped fixture ingests cleanly', () => {
  it('reads, writes and safety-excludes without error', () => {
    const r = prepared()
    const csv = readFileSync(FIXTURE, 'utf8')
    const res = ingest(r, csv)

    expect(res.rowsRead).toBeGreaterThanOrEqual(50)
    expect(res.deadLettered).toBe(0)
    expect(res.errors).toHaveLength(0)
    expect(res.outcome).toBe('success')
    expect(res.rowsWritten + res.rowsExcludedSafety).toBe(res.rowsRead)
  })

  it('the fixture contains BOTH safe and safety-critical rows', () => {
    // Guards against a fixture that accidentally tests only one branch.
    const r = prepared()
    const res = ingest(r, readFileSync(FIXTURE, 'utf8'))
    expect(res.rowsExcludedSafety).toBeGreaterThan(0)
    expect(res.rowsWritten).toBeGreaterThan(0)
  })
})

describe('F012 step 4 / SPEC-001 FR-9, NFR-1 — idempotency', () => {
  it('re-ingesting identical input writes nothing new', () => {
    const r = prepared()
    const csv = readFileSync(FIXTURE, 'utf8')

    const first = ingest(r, csv)
    expect(first.rowsWritten).toBeGreaterThan(0)

    const productsAfterFirst = count(r, 'product')

    const second = ingest(r, csv)
    expect(second.rowsWritten).toBe(0)
    expect(second.rowsUnchanged).toBe(first.rowsWritten)
    expect(count(r, 'product')).toBe(productsAfterFirst)
  })

  it('is stable across many runs', () => {
    const r = prepared()
    const csv = readFileSync(FIXTURE, 'utf8')
    ingest(r, csv)
    const after = count(r, 'product')
    for (let i = 0; i < 3; i++) ingest(r, csv)
    expect(count(r, 'product')).toBe(after)
  })

  it('the safety audit is not duplicated by re-runs', () => {
    const r = prepared()
    const csv = readFileSync(FIXTURE, 'utf8')
    ingest(r, csv)
    const afterFirst = count(r, 'safety_exclusion')
    expect(afterFirst).toBeGreaterThan(0)
    ingest(r, csv)
    expect(count(r, 'safety_exclusion')).toBe(afterFirst)
  })
})

describe('F012 step 5 — a single changed field updates exactly one row', () => {
  it('only the modified product changes', () => {
    const r = prepared()
    const csv = readFileSync(FIXTURE, 'utf8')
    ingest(r, csv)

    const before = r.query<{ external_product_id: string; title: string }>(
      'SELECT external_product_id, title FROM product ORDER BY external_product_id',
    )

    // Change exactly one title.
    const target = '33006951783'
    const modified = csv.replace(
      /Wireless Bluetooth Earbuds Noise Cancelling Sport Headphones/,
      'Wireless Bluetooth Earbuds Pro Noise Cancelling',
    )
    expect(modified).not.toBe(csv)

    const res = ingest(r, modified)
    expect(res.rowsWritten).toBe(1)
    expect(res.rowsUnchanged).toBe(before.length - 1)

    const after = r.query<{ external_product_id: string; title: string }>(
      'SELECT external_product_id, title FROM product ORDER BY external_product_id',
    )
    expect(after.length).toBe(before.length)

    const changed = after.filter((a, i) => a.title !== before[i]!.title)
    expect(changed).toHaveLength(1)
    expect(changed[0]!.external_product_id).toBe(target)
    expect(changed[0]!.title).toContain('Pro')
  })
})

describe('SPEC-001 FR-8 — whole-batch rejection', () => {
  it('a missing required column rejects the batch and writes nothing', () => {
    const r = prepared()
    const bad = `network,external_product_id,title,currency,destination_country,sale_price
aliexpress,1,Thing,USD,US,10.00
`
    expect(() => ingest(r, bad)).toThrow(/Missing required column/)
    expect(count(r, 'product')).toBe(0)
    expect(count(r, 'price_observation')).toBe(0)
  })

  it('a row declaring a different network is rejected, not written under this one', () => {
    const r = prepared()
    const csv = [
      FULL_HEADER,
      row('aliexpress', '1', 'Thing', 'https://x/1', 'USD', 'US', '10.00'),
      row('temu', '2', 'Other Network Item', 'https://x/2', 'USD', 'US', '10.00'),
    ].join('\n')
    const res = ingest(r, csv)
    // The row is dead-lettered, not silently written under 'aliexpress'.
    expect(res.deadLettered).toBe(1)
    expect(res.outcome).toBe('partial')
    expect(count(r, 'product')).toBe(1)
    const ids = r.query<{ external_product_id: string }>('SELECT external_product_id FROM product')
    expect(ids.map((x) => x.external_product_id)).toEqual(['1'])
  })

  it('a truncated file is detected when the row count is declared', () => {
    const r = prepared()
    const csv = readFileSync(FIXTURE, 'utf8').split('\n').slice(0, 20).join('\n')
    expect(() =>
      ingestCsv(r, csv, {
        networkId: 'aliexpress',
        moduleId: 'csv:aliexpress',
        source: 'csv',
        safety: SAFETY,
        expectedRowCount: 66,
      }),
    ).toThrow(IngestError)
    expect(count(r, 'product')).toBe(0)
  })

  it('an unterminated quote is rejected, not partially ingested (EC-6)', () => {
    const r = prepared()
    const truncated = 'network,external_product_id,title,detail_url,currency,destination_country,sale_price\naliexpress,1,"Unclosed Title,https://x/1,USD,US,10.00'
    expect(() => ingest(r, truncated)).toThrow(/Unterminated/)
    expect(count(r, 'product')).toBe(0)
  })
})

describe('SPEC-001 FR-20 — the safety gate runs BEFORE the write', () => {
  it('excluded products never reach the product table', () => {
    const r = prepared()
    ingest(r, readFileSync(FIXTURE, 'utf8'))

    const excludedTitles = r.query<{ title: string }>(
      'SELECT title FROM safety_exclusion',
    )
    expect(excludedTitles.length).toBeGreaterThan(0)

    for (const ex of excludedTitles) {
      const inCatalogue = r.query<{ c: number }>(
        'SELECT count(*) AS c FROM product WHERE title = $1',
        [ex.title],
      )[0]!.c
      expect(inCatalogue, `"${ex.title}" must not be in the catalogue`).toBe(0)
    }
  })

  it('records which keyword caused each exclusion, for audit (SPEC-003 FR-20)', () => {
    const r = prepared()
    ingest(r, readFileSync(FIXTURE, 'utf8'))
    const rows = r.query<{ matched_keyword: string }>(
      'SELECT DISTINCT matched_keyword FROM safety_exclusion ORDER BY 1',
    )
    const keywords = rows.map((x) => x.matched_keyword)
    expect(keywords).toContain('battery')
    expect(keywords.length).toBeGreaterThan(0)
  })
})

describe('SPEC-003 FR-9 — unknown stays NULL, never 0', () => {
  it('a row with no shipping produces an incomplete observation, not a zero', () => {
    const r = prepared()
    const csv = `${REQUIRED_CSV_COLUMNS.join(',')}
aliexpress,90001,No Shipping Item,https://x/90001,USD,US,10.00
`
    ingest(r, csv)
    const row = r.query<{ shipping_minor: number | null; is_complete: number }>(
      'SELECT shipping_minor, is_complete FROM price_observation',
    )[0]!
    expect(row.shipping_minor).toBeNull()
    expect(row.is_complete).toBe(0)
  })

  it('the fixture actually exercises both complete and incomplete rows', () => {
    const r = prepared()
    ingest(r, readFileSync(FIXTURE, 'utf8'))
    const complete = count(r, 'price_observation') - count(r, 'price_observation') +
      r.query<{ c: number }>('SELECT count(*) AS c FROM price_observation WHERE is_complete = 1')[0]!.c
    const incomplete = r.query<{ c: number }>(
      'SELECT count(*) AS c FROM price_observation WHERE is_complete = 0',
    )[0]!.c
    // If incomplete were 0 the unknown-value path would be untested.
    expect(incomplete).toBeGreaterThan(0)
    expect(complete).toBeGreaterThan(0)
  })
})

describe('SPEC-003 FR-7 — destination-keyed pricing', () => {
  it('the same product id in different destinations does not collide', () => {
    const r = prepared()
    const csv = `${REQUIRED_CSV_COLUMNS.join(',')}
aliexpress,90002,Multi Dest Item,https://x/90002,USD,US,10.00
aliexpress,90002,Multi Dest Item,https://x/90002,EUR,DE,9.00
`
    ingest(r, csv)
    expect(count(r, 'product')).toBe(1)
    const obs = r.query<{ destination_country: string; sale_price_minor: number }>(
      'SELECT destination_country, sale_price_minor FROM price_observation ORDER BY 1',
    )
    expect(obs.length).toBe(2)
    expect(obs.find((o) => o.destination_country === 'US')!.sale_price_minor).toBe(1000)
    expect(obs.find((o) => o.destination_country === 'DE')!.sale_price_minor).toBe(900)
  })
})

describe('SPEC-003 FR-19 / SPEC-001 FR-18 — provenance', () => {
  it('every product and observation carries its run id', () => {
    const r = prepared()
    const res = ingest(r, readFileSync(FIXTURE, 'utf8'))

    const orphanProducts = r.query<{ c: number }>(
      'SELECT count(*) AS c FROM product WHERE source_run_id IS NULL',
    )[0]!.c
    expect(orphanProducts).toBe(0)

    const run = r.query<{ c: number }>(
      'SELECT count(*) AS c FROM ingestion_run WHERE run_id = $1',
      [res.runId],
    )[0]!.c
    expect(run).toBe(1)
  })

  it('the run record reports the counts', () => {
    const r = prepared()
    const res = ingest(r, readFileSync(FIXTURE, 'utf8'))
    const row = r.query<{
      rows_read: number; rows_written: number; rows_excluded_safety: number; outcome: string
    }>('SELECT rows_read, rows_written, rows_excluded_safety, outcome FROM ingestion_run WHERE run_id = $1', [res.runId])[0]!
    expect(row.rows_read).toBe(res.rowsRead)
    expect(row.rows_excluded_safety).toBe(res.rowsExcludedSafety)
    expect(row.outcome).toBe('success')
  })
})

describe('SPEC-001 FR-13 — monetisation flag', () => {
  it('a product with no commission rate is not marked monetisable', () => {
    const r = prepared()
    const csv = [
      FULL_HEADER,
      row('aliexpress', '90003', 'No Commission Item', 'https://x/90003', 'USD', 'US', '10.00', '10.00'),
      row('aliexpress', '90004', 'Has Commission Item', 'https://x/90004', 'USD', 'US', '10.00', '10.00', '0.09'),
    ].join('\n')
    ingest(r, csv)
    const rows = r.query<{ external_product_id: string; monetisable: number }>(
      'SELECT external_product_id, monetisable FROM product ORDER BY 1',
    )
    expect(rows.find((x) => x.external_product_id === '90003')!.monetisable).toBe(0)
    expect(rows.find((x) => x.external_product_id === '90004')!.monetisable).toBe(1)
  })
})

describe('row-level failures go to dead-letter, not silent loss (SPEC-001 FR-15)', () => {
  it('a malformed row is dead-lettered while the rest of the batch lands', () => {
    const r = prepared()
    const csv = `${REQUIRED_CSV_COLUMNS.join(',')}
aliexpress,90005,Good One,https://x/90005,USD,US,10.00
aliexpress,,Missing Id,https://x/90006,USD,US,10.00
aliexpress,90007,Good Two,https://x/90007,USD,US,11.00
`
    const res = ingest(r, csv)
    expect(res.deadLettered).toBe(1)
    expect(res.outcome).toBe('partial')
    expect(count(r, 'product')).toBe(2)
    expect(count(r, 'dead_letter')).toBe(1)
  })
})
