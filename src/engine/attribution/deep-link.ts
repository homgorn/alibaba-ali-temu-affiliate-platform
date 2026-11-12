/**
 * Deep-link resolution — SPEC-005 FR-1, FR-3, FR-4, FR-5.
 *
 * The platform prefers the feed's own `promotion_link` over any local
 * construction (FR-1). A link the feed did not provide is NOT constructed
 * here, because the AliExpress promotion-link template would have to be
 * guessed — and guessing is exactly the failure mode this project rejects
 * (R2). When the feed supplies no link, the actionable state is
 * `unavailable` with a reason, not a fabricated URL.
 *
 * `monetisable = 0` products never yield monetised links (FR-4).
 * Alibaba B2B is never linked to a prohibited destination (FR-5, D-009).
 */

export type DeepLinkState =
  | { readonly kind: 'link'; readonly url: string; readonly trackingId: string; readonly monetised: true; readonly source: 'feed' }
  | { readonly kind: 'non-monetised'; readonly reason: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'unavailable'; readonly reason: string }

export interface DeepLinkInput {
  readonly networkId: string
  readonly productId: string
  readonly detailUrl: string
  readonly monetisable: boolean
  readonly destinationCountry: string | null | undefined
  /** The feed's own promotion_link, when one exists. */
  readonly promotionLink: string | null | undefined
  /** The operator's tracking identifier (FR-3). */
  readonly trackingId: string
}

/**
 * Networks that may be linked only under a destination constraint.
 *
 * Alibaba.com B2B explicitly refuses Russian traffic and blocks MMP
 * attribution (verified 2026-10-08, docs/wiki/10-platforms/ALIBABA-B2B.md).
 * Its links MUST NOT be generated for RU-destined traffic. Everything rule:
 * an unknown destination is treated as prohibited for the restricted network —
 * an absent country is not a permission slip.
 */
const DESTINATION_RESTRICTED: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['alibaba', new Set(['RU'])],
])

function restrictedViolation(networkId: string, destinationCountry: string | null | undefined): string | null {
  const banned = DESTINATION_RESTRICTED.get(networkId)
  if (!banned) return null
  const dest = destinationCountry?.toUpperCase()
  if (!dest) return `network ${networkId} requires a destination country; none provided, so the link is refused`
  if (banned.has(dest)) return `network ${networkId} does not allow destination ${dest}`
  return null
}

export function resolveDeepLink(input: DeepLinkInput): DeepLinkState {
  const networkId = input.networkId.trim().toLowerCase()
  const destination = input.destinationCountry?.trim().toUpperCase() ?? null

  // FR-5 — geo policy before any other consideration. A refused link is
  // returned, never constructed, and the reason is surfaced.
  const geoBlock = restrictedViolation(networkId, destination)
  if (geoBlock) return { kind: 'refused', reason: geoBlock }

  // FR-4 — a product without a commission yields no monetised link.
  if (!input.monetisable) {
    return {
      kind: 'non-monetised',
      reason: 'product has no commission rate — no monetised link (SPEC-005 FR-4)',
    }
  }

  // FR-1 — the feed's own promotion_link is preferred over any construction.
  const link = input.promotionLink?.trim()
  if (!link) {
    return {
      kind: 'unavailable',
      reason: 'feed provided no promotion_link; no local template has been verified for this network, so none is issued',
    }
  }

  // FR-3 — every link MUST carry the operator's tracking identifier.
  const trackingId = input.trackingId.trim()
  if (!trackingId) {
    return { kind: 'refused', reason: 'trackingId is not configured' }
  }
  if (!link.includes(encodeURIComponent(trackingId)) && !link.includes(trackingId)) {
    // Not an error we hide: the feed gave us a link we cannot vouch for.
    return {
      kind: 'refused',
      reason: 'feed promotion_link does not contain the operator trackingId — refusing to serve unverified link',
    }
  }

  return { kind: 'link', url: link, trackingId, monetised: true, source: 'feed' }
}
