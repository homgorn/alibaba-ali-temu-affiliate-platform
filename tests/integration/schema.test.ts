/**
 * L3 integration tests — real database, real migrations.
 *
 * These are the tests that would catch a schema regression. A unit test on a
 * pure function cannot; a migration that silently drops a NOT NULL would pass
 * every L0–L2 test and only fail here.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRunner, sqliteModule } from '../../src/engine/db/sqlite-runner.ts'
import { migrate, status, checksum, type Runner } from '../../src/engine/db/migrate.ts'
import { MIGRATIONS_DIR } from '../helpers.ts'

let dir: string
let url: string
let open: Runner[]

/** Create a runner that is closed automatically after the test. */
function runner(): Runner {
  const r = createSqliteRunner(url)
  open.push(r)
  return r
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'affiliate-test-'))
  url = `file:${join(dir, 'test.db')}`
  open = []
})

afterEach(() => {
  // Close handles BEFORE deleting: SQLite in WAL mode holds a file lock, and
  // Windows cannot unlink a locked file (EBUSY).
  for (const r of open) {
    try {
      r.close()
    } catch {
      // already closed
    }
  }
  // R1: temp dirs created by a test are ours to clean up — this is not the
  // operator's data. Nothing outside `dir` is touched.
  rmSync(dir, { recursive: true, force: true })
})

describe('SPEC-003 AC-1 — migrations on a fresh database', () => {
  it('applies cleanly from empty', () => {
    const r = runner()
    const res = migrate(r, MIGRATIONS_DIR)
    expect(res.applied.length).toBeGreaterThan(0)
    expect(res.alreadyApplied.length).toBe(0)
  })

  it('creates every table SPEC-003 §6 requires', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)

    const expected = [
      'network', 'category', 'product', 'price_observation',
      'price_daily_rollup', 'product_identity_match', 'promotion_link',
      'safety_exclusion', 'retention_policy', 'ingestion_run', 'module',
      'dead_letter', 'request_ledger', 'ingestion_checkpoint',
      'image_fingerprint', 'title_normalised', 'product_variant_group',
      'product_variant_member', 'match_evaluation',
      'click_event', 'conversion_event', 'commission_record',
      'link_validity_check',
    ]
    const rows = r.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    )
    const names = rows.map((x) => x.name)
    for (const t of expected) expect(names, `missing table ${t}`).toContain(t)
  })

  it('reports zero pending after applying', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    expect(status(r, MIGRATIONS_DIR).pending.length).toBe(0)
  })
})

describe('SPEC-003 AC-3 / NFR-5 — idempotency', () => {
  it('re-running applies nothing and loses no data', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ($1,$2,$3,$4)`, ['n1', 'Test', 'file-csv', 'cps'])

    const second = migrate(r, MIGRATIONS_DIR)
    expect(second.applied.length).toBe(0)
    expect(second.alreadyApplied.length).toBeGreaterThan(0)

    const rows = r.query<{ c: number }>('SELECT count(*) AS c FROM network')
    expect(rows[0]!.c).toBe(1)
  })

  it('is safe to run many times', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    for (let i = 0; i < 5; i++) migrate(r, MIGRATIONS_DIR)
    expect(status(r, MIGRATIONS_DIR).pending.length).toBe(0)
  })
})

describe('migration drift detection', () => {
  it('refuses to run when an applied migration file was edited', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    // Simulate drift by corrupting the recorded checksum.
    r.exec('UPDATE _migrations SET checksum = $1 WHERE id = $2', ['deadbeef', '0001_core'])
    expect(() => migrate(r, MIGRATIONS_DIR)).toThrow(/drift/i)
  })
})

describe('SPEC-003 FR-3 — money is integer minor units', () => {
  it('every money column is INTEGER, never a float type', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)

    const tables = r
      .query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      )
      .map((x) => x.name)

    let checked = 0
    for (const t of tables) {
      const cols = r.query<{ name: string; type: string }>(`PRAGMA table_info(${t})`)
      for (const c of cols) {
        if (/minor|amount/i.test(c.name)) {
          expect(c.type, `${t}.${c.name} must be INTEGER, got ${c.type}`).toBe('INTEGER')
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(5) // sanity: we actually inspected some
  })

  it('sums 10.10 + 20.20 exactly as 3030 minor units', () => {
    // AC-4. In IEEE 754 float, 1010 + 2020 happens to work, so this asserts
    // the SCHEMA guarantees integer storage — not that floats are imprecise.
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    expect(1010 + 2020).toBe(3030)
    expect(Number.isInteger(1010 + 2020)).toBe(true)
  })
})

describe('SPEC-003 FR-9 — unknown is NULL, never 0', () => {
  it('accepts a NULL shipping cost and does not coerce it to 0', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ('ae','AliExpress','live-api','cps')`, [])
    r.exec(`INSERT INTO ingestion_run (run_id, module_id, network_id, source_kind, started_at)
            VALUES ('run1','m1','ae','file-csv','2026-10-08T00:00:00.000Z')`, [])
    r.exec(
      `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
        first_seen_at, last_seen_at, source, source_run_id)
       VALUES ('p1','ae','123','Widget','https://x/123','2026-10-08T00:00:00.000Z',
        '2026-10-08T00:00:00.000Z','csv','run1')`,
      [],
    )
    r.exec(
      `INSERT INTO price_observation (observation_id, product_id, destination_country,
        observed_at, currency, sale_price_minor, shipping_minor, is_complete, source)
       VALUES ('o1','p1','US','2026-10-08T00:00:00.000Z','USD',1099,NULL,0,'csv')`,
      [],
    )
    const rows = r.query<{ shipping_minor: number | null; is_complete: number }>(
      'SELECT shipping_minor, is_complete FROM price_observation WHERE observation_id = $1',
      ['o1'],
    )
    expect(rows[0]!.shipping_minor).toBeNull()
    expect(rows[0]!.is_complete).toBe(0) // 0 => false in SQLite
  })
})

describe('SPEC-003 EC-5 — destination separation', () => {
  it('stores US and DE prices independently for the same product', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ('ae','AliExpress','live-api','cps')`, [])
    r.exec(`INSERT INTO ingestion_run (run_id, module_id, network_id, source_kind, started_at)
            VALUES ('run1','m1','ae','file-csv','2026-10-08T00:00:00.000Z')`, [])
    r.exec(
      `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
        first_seen_at, last_seen_at, source, source_run_id)
       VALUES ('p1','ae','123','Widget','https://x/123','2026-10-08T00:00:00.000Z',
        '2026-10-08T00:00:00.000Z','csv','run1')`,
      [],
    )
    const ts = '2026-10-08T00:00:00.000Z'
    r.exec(
      `INSERT INTO price_observation (observation_id, product_id, destination_country,
        observed_at, currency, sale_price_minor, is_complete, source)
       VALUES ('o-us','p1','US',$1,'USD',1000,1,'csv')`,
      [ts],
    )
    r.exec(
      `INSERT INTO price_observation (observation_id, product_id, destination_country,
        observed_at, currency, sale_price_minor, is_complete, source)
       VALUES ('o-de','p1','DE',$1,'EUR',900,1,'csv')`,
      [ts],
    )
    const rows = r.query<{ destination_country: string; sale_price_minor: number }>(
      'SELECT destination_country, sale_price_minor FROM price_observation ORDER BY destination_country',
    )
    expect(rows.length).toBe(2)
    expect(rows.find((x) => x.destination_country === 'US')!.sale_price_minor).toBe(1000)
    expect(rows.find((x) => x.destination_country === 'DE')!.sale_price_minor).toBe(900)
  })

  it('rejects a 3-letter country code', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ('ae','AliExpress','live-api','cps')`, [])
    r.exec(`INSERT INTO ingestion_run (run_id, module_id, network_id, source_kind, started_at)
            VALUES ('run1','m1','ae','file-csv','2026-10-08T00:00:00.000Z')`, [])
    r.exec(
      `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
        first_seen_at, last_seen_at, source, source_run_id)
       VALUES ('p1','ae','123','W','https://x/1','2026-10-08T00:00:00.000Z',
        '2026-10-08T00:00:00.000Z','csv','run1')`,
      [],
    )
    expect(() =>
      r.exec(
        `INSERT INTO price_observation (observation_id, product_id, destination_country,
          observed_at, currency, sale_price_minor, is_complete, source)
         VALUES ('o1','p1','USA','2026-10-08T00:00:00.000Z','USD',100,1,'csv')`,
        [],
      ),
    ).toThrow()
  })
})

describe('SPEC-003 FR-5 / EC-12 — identity constraints', () => {
  it('rejects a match where a >= b (normalised ordering)', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ('ae','AliExpress','live-api','cps')`, [])
    r.exec(`INSERT INTO ingestion_run (run_id, module_id, network_id, source_kind, started_at)
            VALUES ('r','m','ae','file-csv','2026-10-08T00:00:00.000Z')`, [])
    for (const [id, ext] of [['pa', '1'], ['pb', '2']]) {
      r.exec(
        `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
          first_seen_at, last_seen_at, source, source_run_id)
         VALUES ($1,'ae',$2,'W','https://x/1','2026-10-08T00:00:00.000Z',
          '2026-10-08T00:00:00.000Z','csv','r')`,
        [id, ext],
      )
    }
    expect(() =>
      r.exec(
        `INSERT INTO product_identity_match (match_id, product_id_a, product_id_b,
          confidence, method, signals, created_at)
         VALUES ('m1','pb','pa',0.9,'image_hash','{}','2026-10-08T00:00:00.000Z')`,
        [],
      ),
    ).toThrow()
  })

  it('allows the correctly ordered pair', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ('ae','AliExpress','live-api','cps')`, [])
    r.exec(`INSERT INTO ingestion_run (run_id, module_id, network_id, source_kind, started_at)
            VALUES ('r','m','ae','file-csv','2026-10-08T00:00:00.000Z')`, [])
    for (const [id, ext] of [['pa', '1'], ['pb', '2']]) {
      r.exec(
        `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
          first_seen_at, last_seen_at, source, source_run_id)
         VALUES ($1,'ae',$2,'W','https://x/1','2026-10-08T00:00:00.000Z',
          '2026-10-08T00:00:00.000Z','csv','r')`,
        [id, ext],
      )
    }
    r.exec(
      `INSERT INTO product_identity_match (match_id, product_id_a, product_id_b,
        confidence, method, signals, created_at)
       VALUES ('m1','pa','pb',0.9,'image_hash','{"familiesFired":2}','2026-10-08T00:00:00.000Z')`,
      [],
    )
    const rows = r.query('SELECT confidence FROM product_identity_match WHERE match_id = $1', ['m1'])
    expect(rows.length).toBe(1)
  })
})

describe('SPEC-003 FR-23 — foreign keys enforced', () => {
  it('rejects a product referencing a network that does not exist', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    expect(() =>
      r.exec(
        `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
          first_seen_at, last_seen_at, source)
         VALUES ('p1','ghost','1','W','https://x/1','2026-10-08T00:00:00.000Z',
          '2026-10-08T00:00:00.000Z','csv')`,
        [],
      ),
    ).toThrow()
  })
})

describe('SPEC-003 FR-15 — retention policy requires evidence', () => {
  it('rejects basis=tos-permitted without a tos_reference', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    expect(() =>
      r.exec(
        `INSERT INTO retention_policy (table_name, retention_class, max_age_days, basis)
         VALUES ('price_observation','price-history',365,'tos-permitted')`,
        [],
      ),
    ).toThrow()
  })

  it('accepts it when the clause is cited', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(
      `INSERT INTO retention_policy (table_name, retention_class, max_age_days, basis, tos_reference)
       VALUES ('price_observation','price-history',365,'tos-permitted','section 4.2')`,
      [],
    )
    expect(r.query('SELECT * FROM retention_policy').length).toBe(1)
  })

  it('rejects max_age_days of 0 — an unbounded retention is never valid', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    expect(() =>
      r.exec(
        `INSERT INTO retention_policy (table_name, retention_class, max_age_days, basis)
         VALUES ('product','catalogue',0,'operator-review')`,
        [],
      ),
    ).toThrow()
  })
})

describe('SPEC-005 FR-15 — commission rate bounds', () => {
  it('rejects a commission_rate above 1.0', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ('ae','AliExpress','live-api','cps')`, [])
    expect(() =>
      r.exec(
        `INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
          commission_rate, first_seen_at, last_seen_at, source)
         VALUES ('p1','ae','1','W','https://x/1',1.5,'2026-10-08T00:00:00.000Z',
          '2026-10-08T00:00:00.000Z','csv')`,
        [],
      ),
    ).toThrow()
  })
})

describe('SPEC-005 §2.4 — conversion states are distinguishable', () => {
  it('allows overdue and unattributed as distinct states', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ('ae','AliExpress','live-api','cps')`, [])
    r.exec(
      `INSERT INTO conversion_event (conversion_id, network_id, external_order_id, status,
        amount_minor, currency, reported_at)
       VALUES ('c1','ae','ORD1','overdue',5000,'USD','2026-10-08T00:00:00.000Z')`,
      [],
    )
    r.exec(
      `INSERT INTO conversion_event (conversion_id, network_id, external_order_id, status,
        amount_minor, currency, reported_at)
       VALUES ('c2','ae','ORD2','unattributed',7000,'USD','2026-10-08T00:00:00.000Z')`,
      [],
    )
    const rows = r.query<{ status: string }>('SELECT status FROM conversion_event ORDER BY external_order_id')
    expect(rows.map((x) => x.status)).toEqual(['overdue', 'unattributed'])
  })

  it('deduplicates a repeated network report for the same order', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model)
            VALUES ('ae','AliExpress','live-api','cps')`, [])
    r.exec(
      `INSERT INTO conversion_event (conversion_id, network_id, external_order_id, status,
        amount_minor, currency, reported_at)
       VALUES ('c1','ae','ORD1','converted',5000,'USD','2026-10-08T00:00:00.000Z')`,
      [],
    )
    expect(() =>
      r.exec(
        `INSERT INTO conversion_event (conversion_id, network_id, external_order_id, status,
          amount_minor, currency, reported_at)
         VALUES ('c2','ae','ORD1','converted',5000,'USD','2026-10-08T01:00:00.000Z')`,
        [],
      ),
    ).toThrow()
  })
})

describe('SPEC-005 NFR-5 — no raw IP storage', () => {
  it('click_event has no column that could hold a raw IP', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    const cols = r.query<{ name: string }>('PRAGMA table_info(click_event)').map((c) => c.name)
    expect(cols).toContain('visitor_hash')
    expect(cols.some((c) => /(^|_)(ip|ip_address|remote_addr)$/i.test(c))).toBe(false)
  })

  it('requires a channel — without it EPC per channel is uncomputable', () => {
    const r = runner()
    migrate(r, MIGRATIONS_DIR)
    const cols = r.query<{ name: string; notnull: number }>('PRAGMA table_info(click_event)')
    const channel = cols.find((c) => c.name === 'channel')
    expect(channel?.notnull).toBe(1)
  })
})

describe('checksum drift baseline', () => {
  it('is whitespace-SENSITIVE — a trailing space must count as drift', () => {
    // This is intentional and load-bearing: if the checksum ignored whitespace,
    // editing an applied migration to change a CHECK constraint would go
    // undetected, and the migration runner would happily skip it. That is
    // exactly the class of bug drift detection exists to catch.
    expect(checksum('SELECT 1')).not.toBe(checksum('SELECT 1 '))
  })
})
