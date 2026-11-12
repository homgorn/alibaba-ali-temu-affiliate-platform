/**
 * Promotion-link store — SPEC-005 FR-6, FR-7, FR-8.
 *
 * A stored link is a cached claim, not a guarantee. `observed_at` makes
 * staleness computable; every new write is recorded with status='unknown'
 * until a check proves it valid (FR-6).
 *
 * The resolver reads the *latest* observed link for the
 * (product_id, destination_country) pair. If the feed re-supplies the link,
 * the unique key on (product_id, destination_country, url) makes a re-ingest
 * a no-op; a genuinely new link from the feed becomes a new row.
 *
 * Links found `invalid` are not served — suppression is enforced by the
 * resolver, not left to callers (FR-8).
 */
import type { Runner } from '../db/migrate.ts'
import { newId } from '../../shared/ids.ts'
import { resolveDeepLink, type DeepLinkState } from './deep-link.ts'

export interface StorePromotionLinkInput {
  readonly productId: string
  readonly destinationCountry?: string | null | undefined
  readonly url: string
  readonly source: 'feed' | 'constructed'
  readonly now?: Date | undefined
}

export interface StoredPromotionLink {
  readonly linkId: string
  readonly productId: string
  readonly destinationCountry: string | null
  readonly url: string
  readonly status: string
  readonly observedAt: string
}

/** Persist the feed's link. Returns the row (or the existing one on re-ingest). */
export function storePromotionLink(runner: Runner, input: StorePromotionLinkInput): StoredPromotionLink {
  const now = input.now ?? new Date()
  const existing = runner.query<{
    link_id: string
    product_id: string
    destination_country: string | null
    url: string
    status: string
    observed_at: string
  }>(
    `SELECT link_id, product_id, destination_country, url, status, observed_at
     FROM promotion_link
     WHERE product_id = $1 AND COALESCE(destination_country, '') = COALESCE($2, '') AND url = $3`,
    [input.productId, input.destinationCountry ?? null, input.url],
  )
  if (existing.length === 1) {
    const e = existing[0]!
    return {
      linkId: e.link_id,
      productId: e.product_id,
      destinationCountry: e.destination_country,
      url: e.url,
      status: e.status,
      observedAt: e.observed_at,
    }
  }

  const linkId = newId()
  const observedAt = now.toISOString()
  runner.exec(
    `INSERT INTO promotion_link
       (link_id, product_id, destination_country, url, source, monetised, status, observed_at)
     VALUES ($1, $2, $3, $4, $5, 1, 'unknown', $6)`,
    [linkId, input.productId, input.destinationCountry ?? null, input.url, input.source, observedAt],
  )
  return {
    linkId,
    productId: input.productId,
    destinationCountry: input.destinationCountry ?? null,
    url: input.url,
    status: 'unknown',
    observedAt,
  }
}

interface PromotionLinkRow {
  url: string
  source: string
  status: string
  observed_at: string
  destination_country: string | null
}

/**
 * Resolve the link the platform would serve for a product.
 *
 * Reads the product's `monetisable` flag and the latest link for the
 * destination; never constructs a link locally. Any link marked `invalid` is
 * dropped. The tracking identifier is required (FR-3) — no tracking id, no link.
 */
export function resolvePromotionLinkFor(
  runner: Runner,
  productId: string,
  destinationCountry: string | null,
  trackingId: string,
): DeepLinkState {
  // The network and monetisable flag come from the DB, never from the caller,
  // so a caller can't grant itself a link for a product that has no commission.
  const productRows = runner.query<{
    monetisable: number | boolean
    network_id: string
  }>(
    `SELECT monetisable, network_id FROM product WHERE product_id = $1`,
    [productId],
  )
  const product = productRows[0]
  if (!product) {
    return { kind: 'refused', reason: `product not found: ${productId}` }
  }

  // A link whose status is invalid must never be served (FR-8). A stale but
  // previously-valid link is served with its observed_at intact so the caller
  // can show staleness — revalidation is the caller's job for now.
  const dest = destinationCountry?.trim().toUpperCase() ?? null
  const links = runner.query<PromotionLinkRow>(
    `SELECT url, source, status, observed_at, destination_country
     FROM promotion_link
     WHERE product_id = $1
       AND COALESCE(destination_country, '') = COALESCE($2, '')
       AND status != 'invalid'
     ORDER BY observed_at DESC`,
    [productId, dest],
  )
  const latest = links[0]

  return resolveDeepLink({
    networkId: product.network_id,
    productId,
    detailUrl: '',
    monetisable: product.monetisable === 1 || product.monetisable === true,
    destinationCountry: destinationCountry ?? null,
    promotionLink: latest?.url ?? null,
    trackingId,
  })
}
