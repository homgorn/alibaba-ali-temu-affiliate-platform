/**
 * Click tracking — SPEC-005 FR-9, FR-10, FR-12, FR-20.
 *
 * A click is recorded BEFORE the redirect, never after: if the recording
 * fails, the link still works (FR-12 — tracking MUST NOT block outbound
 * navigation), so the failure is logged and swallowed by the handler.
 *
 * `channel` is REQUIRED (FR-9): without it EPC per channel is uncomputable.
 * `visitorHash` is a salted hash, never the raw IP (FR-10).
 */
import type { Runner } from '../db/migrate.ts'
import { newId } from '../../shared/ids.ts'
import { hashVisitor } from './visitor-hash.ts'

export interface RecordClickInput {
  readonly productId: string
  readonly channel: string
  readonly destinationCountry?: string | undefined
  /** Caller's host. Self-referred when the click comes from our own domain. */
  readonly sourceHost: string
  /** Raw IP — hashed in this function, never stored. */
  readonly ip: string
  readonly userAgent?: string | undefined
  readonly salt?: string | undefined
  /** Override the attribution window (days). Defaults to the network's, else 30. */
  readonly attributionDays?: number | undefined
  readonly now?: Date | undefined
}

export interface RecordedClick {
  readonly clickId: string
  readonly productId: string
  readonly networkId: string
  readonly channel: string
  readonly clickedAt: string
  readonly attributeUntil: string
  readonly selfReferred: boolean
}

const DEFAULT_ATTRIBUTION_DAYS = 30

export class ClickError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClickError'
  }
}

interface ProductRow {
  product_id: string
  network_id: string
}

interface NetworkRow {
  cookie_window_days: number | null
}

export function recordClick(r: Runner, input: RecordClickInput): RecordedClick {
  const now = input.now ?? new Date()
  const channel = input.channel?.trim()
  if (!channel) {
    throw new ClickError('channel is required — without it EPC per channel is uncomputable (SPEC-005 FR-9)')
  }

  const productRows = r.query<ProductRow>(
    'SELECT product_id, network_id FROM product WHERE product_id = $1',
    [input.productId],
  )
  const product = productRows[0]
  if (!product) throw new ClickError(`product not found: ${input.productId}`)

  const netRows = r.query<NetworkRow>(
    'SELECT cookie_window_days FROM network WHERE network_id = $1',
    [product.network_id],
  )
  const cookieDays = netRows[0]?.cookie_window_days ?? DEFAULT_ATTRIBUTION_DAYS
  const clampedDays = Math.min(Math.max(Math.floor(input.attributionDays ?? cookieDays), 1), 365)

  const clickId = newId()
  const clickedAt = now.toISOString()
  const attributeUntil = new Date(now.getTime() + clampedDays * 24 * 60 * 60 * 1000).toISOString()

  // FR-20: a click from our own host is marked self-referred and kept OUT of
  // revenue attribution. The marker is recorded, not used to hide the row.
  const selfReferred = isOwnDomain(input.sourceHost)
  // FR-10: hash here so the raw IP never reaches the SQL layer or any log.
  const visitorHash = hashVisitor(input.ip, input.userAgent, input.salt)

  r.exec(
    `INSERT INTO click_event
       (click_id, product_id, network_id, destination_country, channel, clicked_at,
        visitor_hash, self_referred, attribution_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      clickId,
      product.product_id,
      product.network_id,
      input.destinationCountry ?? null,
      channel,
      clickedAt,
      visitorHash,
      selfReferred ? 1 : 0,
      attributeUntil,
    ],
  )

  return {
    clickId,
    productId: product.product_id,
    networkId: product.network_id,
    channel,
    clickedAt,
    attributeUntil,
    selfReferred,
  }
}

function isOwnDomain(host: string | undefined): boolean {
  if (!host) return false
  const ours = process.env.PUBLIC_SITE_URL
  if (!ours) return false
  try {
    return new URL(ours).hostname.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}