import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteRunner } from '../../src/engine/db/sqlite-runner.ts'
import { migrate, type Runner } from '../../src/engine/db/migrate.ts'
import { MIGRATIONS_DIR } from '../helpers.ts'
import { resolveDeepLink } from '../../src/engine/attribution/deep-link.ts'
import { storePromotionLink, resolvePromotionLinkFor } from '../../src/engine/attribution/promotion-link.ts'

let dir: string
let r: Runner

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deeplink-test-'))
  r = createSqliteRunner(`file:${join(dir, 'test.db')}`)
  migrate(r, MIGRATIONS_DIR)
  r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model,
            cookie_window_days, supports_product_feed, supports_deep_links)
          VALUES ('aliexpress','AliExpress','live-api','cps',3,1,1)`, [])
  r.exec(`INSERT INTO network (network_id, display_name, source_kind, commission_model,
            cookie_window_days, supports_product_feed, supports_deep_links)
          VALUES ('alibaba','Alibaba.com B2B','live-api','cps',60,1,1)`, [])
  // AliExpress product, monetisable
  r.exec(`INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
            commission_rate, monetisable, safety_excluded, first_seen_at, last_seen_at, source)
          VALUES ('ae1','aliexpress','4001','Generic Item','https://x/ae1',0.08,1,0,
            '2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','csv')`, [])
  // AliExpress product, NOT monetisable
  r.exec(`INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
            commission_rate, monetisable, safety_excluded, first_seen_at, last_seen_at, source)
          VALUES ('ae2','aliexpress','4002','No-commission Item','https://x/ae2',NULL,0,0,
            '2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','csv')`, [])
  // Alibaba B2B product, monetisable
  r.exec(`INSERT INTO product (product_id, network_id, external_product_id, title, detail_url,
            commission_rate, monetisable, safety_excluded, first_seen_at, last_seen_at, source)
          VALUES ('ab1','alibaba','5001','Wholesale Gadget','https://x/ab1',0.10,1,0,
            '2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','csv')`, [])
})

afterEach(() => {
  r.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('resolveDeepLink (SPEC-005 FR-1/FR-4/FR-5)', () => {
  it('serves the feed promotion_link when it carries the trackingId', () => {
    const out = resolveDeepLink({
      networkId: 'aliexpress',
      productId: 'p',
      detailUrl: 'https://x',
      monetisable: true,
      destinationCountry: 'US',
      promotionLink: 'https://s.click.aliexpress.com/e/_abc?s=trx123&p=prod-42',
      trackingId: 'trx123',
    })
    expect(out.kind).toBe('link')
    if (out.kind === 'link') {
      expect(out.url).toContain('trx123')
      expect(out.monetised).toBe(true)
      expect(out.source).toBe('feed')
    }
  })

  it('refuses when the feed link does not carry the trackingId', () => {
    const out = resolveDeepLink({
      networkId: 'aliexpress',
      productId: 'p',
      detailUrl: 'https://x',
      monetisable: true,
      destinationCountry: 'US',
      promotionLink: 'https://s.click.aliexpress.com/e/_abc?s=someone_else',
      trackingId: 'trx123',
    })
    expect(out.kind).toBe('refused')
  })

  it('never produces a monetised link for a non-monetisable product', () => {
    const out = resolveDeepLink({
      networkId: 'aliexpress',
      productId: 'p',
      detailUrl: 'https://x',
      monetisable: false,
      destinationCountry: 'US',
      promotionLink: 'https://s.click.aliexpress.com/e/_abc?s=trx123',
      trackingId: 'trx123',
    })
    expect(out.kind).toBe('non-monetised')
  })

  it('B2B is refused for RU destinations even with a valid link', () => {
    const out = resolveDeepLink({
      networkId: 'alibaba',
      productId: 'p',
      detailUrl: 'https://x',
      monetisable: true,
      destinationCountry: 'RU',
      promotionLink: 'https://click.alibaba.com/rd/abc?tp1=trx123',
      trackingId: 'trx123',
    })
    expect(out.kind).toBe('refused')
    if (out.kind === 'refused') expect(out.reason).toMatch(/RU/i)
  })

  it('B2B without a destination is refused, not allowed', () => {
    const out = resolveDeepLink({
      networkId: 'alibaba',
      productId: 'p',
      detailUrl: 'https://x',
      monetisable: true,
      destinationCountry: null,
      promotionLink: 'https://click.alibaba.com/rd/abc?tp1=trx123',
      trackingId: 'trx123',
    })
    expect(out.kind).toBe('refused')
  })

  it('unavailable without a feed promotion_link — never constructs one', () => {
    const out = resolveDeepLink({
      networkId: 'aliexpress',
      productId: 'p',
      detailUrl: 'https://x',
      monetisable: true,
      destinationCountry: 'US',
      promotionLink: null,
      trackingId: 'trx123',
    })
    expect(out.kind).toBe('unavailable')
  })
})

describe('resolvePromotionLinkFor (DB, FR-6/FR-8)', () => {
  function seedLink(productId: string, url: string, dest: string | null, trackingId: string) {
    storePromotionLink(r, { productId, destinationCountry: dest, url, source: 'feed', now: new Date('2026-11-04T00:00:00.000Z') })
  }

  it('resolves the feed link from the DB, with trackingId verified', () => {
    seedLink('ae1', 'https://s.click.aliexpress.com/e/_x?s=trx123', 'US', 'trx123')
    const out = resolvePromotionLinkFor(r, 'ae1', 'US', 'trx123')
    expect(out.kind).toBe('link')
    if (out.kind === 'link') expect(out.url).toContain('trx123')
  })

  it('returns unavailable when the DB has no link — never fabricates', () => {
    const out = resolvePromotionLinkFor(r, 'ae1', 'US', 'trx123')
    expect(out.kind).toBe('unavailable')
  })

  it('non-monetisable product yields non-monetised even with a stored link', () => {
    seedLink('ae2', 'https://s.click.aliexpress.com/e/_x?s=trx123', 'US', 'trx123')
    const out = resolvePromotionLinkFor(r, 'ae2', 'US', 'trx123')
    expect(out.kind).toBe('non-monetised')
  })

  it('B2B RU destination is refused even with a stored link', () => {
    seedLink('ab1', 'https://click.alibaba.com/rd/x?tp1=trx123', 'RU', 'trx123')
    const out = resolvePromotionLinkFor(r, 'ab1', 'RU', 'trx123')
    expect(out.kind).toBe('refused')
  })

  it('invalid stored links are suppressed', () => {
    seedLink('ae1', 'https://s.click.aliexpress.com/e/_x?s=trx123', 'US', 'trx123')
    r.exec(`UPDATE promotion_link SET status = 'invalid' WHERE product_id = 'ae1'`, [])
    const out = resolvePromotionLinkFor(r, 'ae1', 'US', 'trx123')
    expect(out.kind).toBe('unavailable')
  })
})
