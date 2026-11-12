import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRunner } from '../../src/engine/db/sqlite-runner.ts'
import { migrate, type Runner } from '../../src/engine/db/migrate.ts'
import { MIGRATIONS_DIR } from '../helpers.ts'
import { recordClick, ClickError } from '../../src/engine/attribution/click.ts'
import { recordConversion, PostbackError } from '../../src/engine/attribution/postback.ts'
import { epcByChannel } from '../../src/engine/attribution/epc.ts'
import { hashVisitor } from '../../src/engine/attribution/visitor-hash.ts'

let dir: string
let r: Runner

function prepareDb() {
  migrate(r, MIGRATIONS_DIR)
  r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model, cookie_window_days, supports_product_feed, supports_deep_links)
          VALUES ('aliexpress','AliExpress','live-api','cps',3,1,1)`, [])
  r.exec(`INSERT INTO product (product_id, network_id, external_product_id, title, detail_url, category_path,
            commission_rate, monetisable, safety_excluded, first_seen_at, last_seen_at, source)
          VALUES ('p1','aliexpress','1001','Test Product','https://x/p1','Electronics>Headphones',
            0.08,1,0,'2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','csv')`, [])
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'attr-test-'))
  r = createSqliteRunner(`file:${join(dir, 'test.db')}`)
  prepareDb()
})
afterEach(() => {
  r.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('hashVisitor (SPEC-005 FR-10)', () => {
  it('is deterministic and salted', () => {
    const a = hashVisitor('1.2.3.4', 'UA', 'salt-one')
    const b = hashVisitor('1.2.3.4', 'UA', 'salt-one')
    const c = hashVisitor('1.2.3.4', 'UA', 'salt-two')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toContain('1.2.3.4')
    expect(a.length).toBeGreaterThan(20)
  })

  it('never contains the raw IP', () => {
    const h = hashVisitor('203.0.113.7', 'UA', 'salt-x')
    expect(h).not.toContain('203')
    expect(h).not.toContain('0.113')
  })
})

describe('recordClick (SPEC-005 FR-9/FR-10/FR-20)', () => {
  it('requires a channel — without it EPC is uncomputable', () => {
    expect(() => recordClick(r, { productId: 'p1', channel: ' ', sourceHost: 'x.com', ip: '1.1.1.1' })).toThrow(ClickError)
  })

  it('requires an existing product', () => {
    expect(() => recordClick(r, { productId: 'nope', channel: 'seo', sourceHost: 'x.com', ip: '1.1.1.1' })).toThrow(ClickError)
  })

  it('stores the click with channel and hashed visitor, never raw IP', () => {
    const click = recordClick(r, {
      productId: 'p1',
      channel: 'seo',
      sourceHost: 'other.com',
      ip: '203.0.113.7',
      now: new Date('2026-10-01T00:00:00.000Z'),
      salt: 'test-salt',
    })
    const rows = r.query<{ channel: string; visitor_hash: string; self_referred: number }>(
      'SELECT channel, visitor_hash, self_referred FROM click_event WHERE click_id = $1',
      [click.clickId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.channel).toBe('seo')
    expect(rows[0]!.visitor_hash).not.toContain('203.0.113.7')
    expect(rows[0]!.self_referred).toBe(0)
  })

  it('marks clicks from our own host as self-referred', () => {
    process.env.PUBLIC_SITE_URL = 'https://oursite.pages.dev'
    const click = recordClick(r, {
      productId: 'p1',
      channel: 'telegram',
      sourceHost: 'oursite.pages.dev',
      ip: '1.1.1.1',
      now: new Date('2026-10-01T00:00:00.000Z'),
      salt: 'test-salt',
    })
    expect(click.selfReferred).toBe(true)
    const rows = r.query<{ self_referred: number }>('SELECT self_referred FROM click_event WHERE click_id = $1', [click.clickId])
    expect(rows[0]!.self_referred).toBe(1)
    delete process.env.PUBLIC_SITE_URL
  })

  it('attribution window uses the network cookie window (AliExpress 3 days)', () => {
    const click = recordClick(r, {
      productId: 'p1',
      channel: 'seo',
      sourceHost: 'x.com',
      ip: '1.1.1.1',
      now: new Date('2026-10-01T00:00:00.000Z'),
      salt: 's',
    })
    const until = new Date(click.attributeUntil).getTime()
    const start = new Date('2026-10-01T00:00:00.000Z').getTime()
    expect(Math.round((until - start) / 86_400_000)).toBe(3)
  })
})

describe('recordConversion (SPEC-005 FR-15 / EC-12)', () => {
  function click(id: string, channel = 'seo') {
    r.exec(
      `INSERT INTO click_event (click_id, product_id, network_id, destination_country, channel, clicked_at,
         visitor_hash, self_referred, attribution_expires_at)
       VALUES ('${id}','p1','aliexpress','US','${channel}','2026-10-01T00:00:00.000Z','hash${id}',0,'2026-10-04T00:00:00.000Z')`,
      [],
    )
    return id
  }

  it('stores the conversion as pending by default', () => {
    click('c1')
    const out = recordConversion(r, {
      networkId: 'aliexpress',
      externalOrderId: 'ORD-1',
      amountMinor: 1000,
      currency: 'USD',
      clickId: 'c1',
    })
    expect(out.created).toBe(true)
    expect(out.status).toBe('pending')
    expect(out.clickId).toBe('c1')
  })

  it('is idempotent on (network_id, external_order_id) — no double count', () => {
    click('c1')
    const first = recordConversion(r, {
      networkId: 'aliexpress', externalOrderId: 'ORD-1', amountMinor: 1000, currency: 'USD', clickId: 'c1',
    })
    const second = recordConversion(r, {
      networkId: 'aliexpress', externalOrderId: 'ORD-1', amountMinor: 9999, currency: 'USD', clickId: 'c1',
    })
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.conversionId).toBe(first.conversionId)
    const count = (r.query<{ c: number }>('SELECT COUNT(*) AS c FROM conversion_event'))[0]!.c
    expect(count).toBe(1)
  })

  it('links only when the click exists and belongs to the same network', () => {
    click('c1')
    r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model, cookie_window_days, supports_product_feed, supports_deep_links)
            VALUES ('rival','Rival','live-api','cps',3,1,1)`, [])
    r.exec(`INSERT INTO product (product_id, network_id, external_product_id, title, detail_url, commission_rate, monetisable,
              safety_excluded, first_seen_at, last_seen_at, source)
            VALUES ('p2','rival','2001','Other product','https://x/p2',0.08,1,0,'2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','csv')`, [])
    r.exec(`INSERT INTO click_event (click_id, product_id, network_id, destination_country, channel, clicked_at,
              visitor_hash, self_referred, attribution_expires_at)
            VALUES ('c2','p2','rival','US','seo','2026-10-01T00:00:00.000Z','hash2',0,'2026-10-04T00:00:00.000Z')`, [])
    const out = recordConversion(r, {
      networkId: 'aliexpress', externalOrderId: 'ORD-2', amountMinor: 500, currency: 'USD', clickId: 'c2',
    })
    expect(out.clickId).toBeNull()
  })

  it('rejects a negative amount', () => {
    expect(() => recordConversion(r, {
      networkId: 'aliexpress', externalOrderId: 'ORD-X', amountMinor: -1, currency: 'USD',
    })).toThrow(PostbackError)
  })

  it('rejects a non-3-letter currency', () => {
    expect(() => recordConversion(r, {
      networkId: 'aliexpress', externalOrderId: 'ORD-Y', amountMinor: 1, currency: 'US',
    })).toThrow(PostbackError)
  })

  it('rejects an unknown network', () => {
    expect(() => recordConversion(r, {
      networkId: 'nope', externalOrderId: 'ORD-Z', amountMinor: 1, currency: 'USD',
    })).toThrow(PostbackError)
  })
})

describe('epcByChannel', () => {
  it('computes earnings per click per channel, self-referrals excluded', () => {
    r.exec(`INSERT INTO click_event (click_id, product_id, network_id, destination_country, channel, clicked_at,
              visitor_hash, self_referred, attribution_expires_at)
            VALUES
              ('a','p1','aliexpress','US','seo','2026-10-01T00:00:00.000Z','ha',0,'2026-10-04T00:00:00.000Z'),
              ('b','p1','aliexpress','US','seo','2026-10-02T00:00:00.000Z','hb',0,'2026-10-05T00:00:00.000Z'),
              ('c','p1','aliexpress','US','telegram','2026-10-01T00:00:00.000Z','hc',0,'2026-10-04T00:00:00.000Z'),
              ('d','p1','aliexpress','US','seo','2026-10-01T00:00:00.000Z','hd',1,'2026-10-04T00:00:00.000Z')`, [])
    r.exec(`INSERT INTO conversion_event
              (conversion_id, network_id, external_order_id, click_id, status, amount_minor, currency, reported_at)
            VALUES
              ('cv1','aliexpress','ORD-1','a','converted',1000,'USD','2026-10-03T00:00:00.000Z'),
              ('cv2','aliexpress','ORD-2','a','pending',500,'USD','2026-10-03T00:00:00.000Z')`, [])
    const rep = epcByChannel(r, 'USD')
    const seo = rep.rows.find((x) => x.channel === 'seo')!
    // Self-referral (d) excluded from clicks; only converted (cv1) counts.
    expect(seo.clicks).toBe(2)
    expect(seo.commissionMinor).toBe(1000)
    expect(seo.epcMinor).toBe(500)
    // 500 (pending) must NOT enter earnings.
    const telegram = rep.rows.find((x) => x.channel === 'telegram')!
    expect(telegram.clicks).toBe(1)
    expect(telegram.epcMinor).toBe(0)
  })
})
