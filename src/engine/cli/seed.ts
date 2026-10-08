/**
 * Seed the reference networks so a fresh checkout can ingest immediately.
 *
 * Verified facts are marked; anything unverified is left NULL rather than
 * guessed (AGENTS.md R2). Specifically:
 *
 *  - AliExpress cookie window = 3 days (3 independent programme directories,
 *    CONFIDENCE: MEDIUM — re-verify before relying on it).
 *  - Alibaba.com B2B is NOT seeded as a feed network: it has no public product
 *    feed, it refuses Russian traffic, and it refuses all MMP attribution.
 *    Recorded as a comment rather than a row so nobody "fixes" it into one.
 */

import { join } from 'node:path'
import { loadEnv, resolveRunner } from './migrate.ts'
import { newId } from '../../shared/ids.ts'

export function seed(runner: ReturnType<typeof resolveRunner>): void {
  runner.begin()
  try {
    runner.exec(
      `INSERT INTO network (network_id, display_name, source_kind, commission_model,
         cookie_window_days, supports_product_feed, supports_deep_links, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1)
       ON CONFLICT (network_id) DO UPDATE SET
         display_name = excluded.display_name,
         source_kind = excluded.source_kind,
         commission_model = excluded.commission_model,
         cookie_window_days = excluded.cookie_window_days,
         supports_product_feed = excluded.supports_product_feed,
         supports_deep_links = excluded.supports_deep_links`,
      ['aliexpress', 'AliExpress', 'live-api', 'cps', 3, 1, 1],
    )

    runner.exec(
      `INSERT INTO network (network_id, display_name, source_kind, commission_model,
         cookie_window_days, supports_product_feed, supports_deep_links, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1)
       ON CONFLICT (network_id) DO UPDATE SET display_name = excluded.display_name`,
      // Temu: NO public API was found (both partner URLs are JS shells), so this
      // is file-csv only. See docs/wiki/10-platforms/TEMU.md.
      ['temu', 'Temu', 'file-csv', 'cps', null, 0, 0],
    )

    runner.exec(
      `INSERT INTO network (network_id, display_name, source_kind, commission_model,
         cookie_window_days, supports_product_feed, supports_deep_links, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1)
       ON CONFLICT (network_id) DO UPDATE SET display_name = excluded.display_name`,
      // Amazon: Creators API is the supported successor. PA-API 5 is DEPRECATED
      // and returns AccessDenied — verified 2026-10-08. Cookie window UNVERIFIED.
      ['amazon', 'Amazon (Creators API)', 'live-api', 'cps', null, 1, 1],
    )

    // Retention defaults. Conservative and NOT ToS-sourced (open gap M6) —
    // tighten when the actual clauses are known.
    const retention: [string, string, number, string, string | null][] = [
      ['product', 'catalogue', 30, 'operator-review', null],
      ['category', 'catalogue', 30, 'operator-review', null],
      ['price_observation', 'price-history', 365, 'operator-review', 'rollup_to=price_daily_rollup'],
      ['price_daily_rollup', 'derived-aggregate', 1095, 'derived-aggregate', null],
      ['safety_exclusion', 'catalogue', 365, 'operator-review', null],
      ['click_event', 'attribution', 90, 'operator-review', null],
      ['conversion_event', 'attribution', 730, 'operator-review', null],
      ['commission_record', 'attribution', 1825, 'operator-review', null],
    ]
    for (const [table, cls, days, basis, extra] of retention) {
      const [rollup] = (extra ?? '').split('=')
      runner.exec(
        `INSERT INTO retention_policy (table_name, retention_class, max_age_days, basis, rollup_to)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (table_name) DO UPDATE SET
           retention_class = excluded.retention_class,
           max_age_days = excluded.max_age_days,
           basis = excluded.basis,
           rollup_to = excluded.rollup_to`,
        [table, cls, days, basis, rollup || null],
      )
    }

    runner.commit()
  } catch (err) {
    runner.rollback()
    throw err
  }
}

export function main(): number {
  loadEnv()
  const url = process.env.DATABASE_URL ?? 'file:./data/dev.db'
  let runner
  try {
    runner = resolveRunner(url)
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`)
    return 1
  }
  try {
    seed(runner)
    console.log('✓ seeded networks and retention policy')
    const rows = runner.query<{ network_id: string; source_kind: string }>(
      'SELECT network_id, source_kind FROM network ORDER BY network_id',
    )
    for (const r of rows) console.log(`  ${r.network_id.padEnd(12)} ${r.source_kind}`)
    return 0
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`)
    return 1
  } finally {
    runner.close()
  }
}

void newId
void join

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  process.exit(main())
}
