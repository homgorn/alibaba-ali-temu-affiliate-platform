/**
 * EPC (earnings per click) per channel — SPEC-005 FR-9, issue #2.
 *
 * Our record and the network's report are never collapsed: EPC counts only
 * conversions we can tie to our clicks AND that are 'converted' (or the
 * network has confirmed payment, where supported). Unattributed reports are
 * surfaced separately, never mixed in.
 *
 * EPC = SUM(commissions on converted conversions linked to our clicks)
 *       / COUNT(clicks, self_referred = 0)
 * per channel.
 *
 * `amount_minor` in conversion_event is the network-reported payout, so it is
 * used directly as the numerator — not an order value.
 */
import type { Runner } from '../db/migrate.ts'

export interface ChannelEpc {
  readonly channel: string
  readonly clicks: number
  readonly conversions: number
  readonly commissionMinor: number
  readonly currency: string
  readonly epcMinor: number | null
}

export interface EpcReport {
  readonly rows: ChannelEpc[]
  /** Network-reported conversions with no matching click. Surfaced, never
   *  silently attributed (SPEC-005 FR-13). */
  readonly unattributed: number
}

export function epcByChannel(r: Runner, currency = 'USD'): EpcReport {
  const rows = r.query<{
    channel: string
    clicks: number
    conversions: number | null
    commission: number | null
  }>(
    `SELECT
       ce.channel                                             AS channel,
       COUNT(DISTINCT ce.click_id)                            AS clicks,
       COUNT(DISTINCT cv.conversion_id) FILTER (WHERE cv.status = 'converted') AS conversions,
       COALESCE(SUM(cv.amount_minor) FILTER (WHERE cv.status = 'converted'), 0) AS commission
     FROM click_event ce
     LEFT JOIN conversion_event cv
       ON cv.click_id = ce.click_id
      AND cv.currency = $1
     WHERE ce.self_referred = 0
     GROUP BY ce.channel
     ORDER BY commission DESC`,
    [currency.toUpperCase()],
  )

  const unattributed = r.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM conversion_event WHERE click_id IS NULL`,
  )[0]?.c ?? 0

  return {
    rows: rows.map((row) => ({
      channel: row.channel,
      clicks: Number(row.clicks),
      conversions: Number(row.conversions ?? 0),
      commissionMinor: Number(row.commission ?? 0),
      currency: currency.toUpperCase(),
      epcMinor: Number(row.clicks) > 0 ? Number(row.commission ?? 0) / Number(row.clicks) : null,
    })),
    unattributed: Number(unattributed),
  }
}