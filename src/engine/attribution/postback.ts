/**
 * Network postback — SPEC-005 FR-13/FR-14/FR-15, EC-12.
 *
 * A network tells us about conversions. Our record and the network's record
 * are NEVER reconciled silently: both are stored, and any delta is surfaced.
 *
 * `external_order_id` (the network's order id) is the idempotency key — a
 * duplicate postback for the same order must not double-count (EC-12). The
 * row is re-reported, however, so we treat "already have this order" as a
 * no-op with a 200 and report `created: false`.
 *
 * `amount_minor` means "what the network reports this conversion is worth to
 * us" — for AliExpress that is `est_com` (the commission estimate), which is
 * exactly what EPC needs. A network that reports only order value must be
 * wired up to a per-network adapter before it is connected; guessing the
 * value from a rate later would fabricate money.
 *
 * Status defaults to 'pending' (FR-15).
 */
import type { Runner } from '../db/migrate.ts'
import { newId } from '../../shared/ids.ts'

export type ConversionStatus =
  | 'pending'
  | 'converted'
  | 'refunded'
  | 'overdue'
  | 'unattributed'

const VALID_STATUSES: readonly ConversionStatus[] = ['pending', 'converted', 'refunded', 'overdue', 'unattributed']

export interface RecordConversionInput {
  readonly networkId: string
  readonly externalOrderId: string
  readonly amountMinor: number
  readonly currency: string
  /** Links to our click, when the network echoes our click id. */
  readonly clickId?: string | undefined
  readonly status?: ConversionStatus | undefined
  readonly reportedAt?: string | undefined
  readonly now?: Date | undefined
}

export interface RecordedConversion {
  readonly conversionId: string
  readonly created: boolean
  readonly networkId: string
  readonly externalOrderId: string
  readonly status: ConversionStatus
  readonly clickId: string | null
}

export class PostbackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PostbackError'
  }
}

export function recordConversion(r: Runner, input: RecordConversionInput): RecordedConversion {
  const now = input.now ?? new Date()

  if (!input.externalOrderId?.trim()) {
    throw new PostbackError('external_order_id is required — it is the idempotency key (SPEC-005 EC-12)')
  }
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
    throw new PostbackError('amount_minor must be a non-negative safe integer (minor units, SPEC-003 FR-3)')
  }
  if (!/^[A-Za-z]{3}$/.test(input.currency ?? '')) {
    throw new PostbackError('currency must be ISO-4217 (3 letters)')
  }
  const status: ConversionStatus = input.status ?? 'pending'
  if (!VALID_STATUSES.includes(status)) {
    throw new PostbackError(`status must be one of ${VALID_STATUSES.join(', ')}`)
  }

  const net = r.query<{ network_id: string }>('SELECT network_id FROM network WHERE network_id = $1', [input.networkId])
  if (net.length === 0) throw new PostbackError(`unknown network: ${input.networkId}`)

  // Link to our click only when it exists AND belongs to the same network —
  // otherwise we would attribute a network's report to a click it did not send.
  let clickId: string | null = null
  if (input.clickId) {
    const click = r.query<{ click_id: string; network_id: string }>(
      'SELECT click_id, network_id FROM click_event WHERE click_id = $1',
      [input.clickId],
    )
    if (click.length === 1 && click[0]!.network_id === input.networkId) {
      clickId = click[0]!.click_id
    }
  }

  const conversionId = newId()
  const reportedAt = input.reportedAt ?? now.toISOString()

  // EC-12: ON CONFLICT DO NOTHING + RETURNING. When the order is already
  // known we get zero rows back and treat the postback as an idempotent
  // no-op (200). RETURNING keeps the check atomic with the insert — no
  // SELECT-then-INSERT race.
  const inserted = r.query<{ conversion_id: string }>(
    `INSERT INTO conversion_event
       (conversion_id, network_id, external_order_id, click_id, status, amount_minor, currency, reported_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (network_id, external_order_id) DO NOTHING
     RETURNING conversion_id`,
    [conversionId, input.networkId, input.externalOrderId, clickId, status, input.amountMinor, input.currency.toUpperCase(), reportedAt],
  )

  if (inserted.length === 0) {
    const existing = r.query<{ conversion_id: string; status: string; click_id: string | null }>(
      'SELECT conversion_id, status, click_id FROM conversion_event WHERE network_id = $1 AND external_order_id = $2',
      [input.networkId, input.externalOrderId],
    )[0]!
    return {
      conversionId: existing.conversion_id,
      created: false,
      networkId: input.networkId,
      externalOrderId: input.externalOrderId,
      status: existing.status as ConversionStatus,
      clickId: existing.click_id,
    }
  }

  return {
    conversionId: inserted[0]!.conversion_id,
    created: true,
    networkId: input.networkId,
    externalOrderId: input.externalOrderId,
    status,
    clickId,
  }
}