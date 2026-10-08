/**
 * ModuleContract — the explicit plugin interface from SPEC-001 §6.
 *
 * Every network/source integration (live API, file, manual) implements this one
 * interface, so the engine never special-cases a network (FR-1). A source with
 * no API — like Temu, verified — can still satisfy the contract via
 * `file-csv`/`manual-curated`, which is what SPEC-001 FR-6 requires.
 *
 * Capabilities are declared as flags rather than a single shape, because tier-1
 * (product-feed) and tier-2 (report-only) networks are structurally different
 * and a contract that pretends otherwise would be wrong (SPEC-001 §1 reasoning).
 */

export type SourceKind = 'live-api' | 'file-csv' | 'manual-curated'

export interface ModuleCapabilities {
  readonly supportsProductFeed: boolean
  readonly supportsDeepLinks: boolean
  readonly supportsConversionReporting: boolean
  readonly supportsBulkDownload: boolean
}

export interface RetentionClass {
  readonly name: string
  readonly maxAgeDays: number
  readonly basis: 'tos-permitted' | 'derived-aggregate' | 'operator-review'
}

export interface RateLimits {
  readonly requestsPerSecond?: number
  readonly requestsPerDay?: number
}

export interface HealthStatus {
  readonly reachable: boolean
  readonly lastSuccessAt: Date | null
  readonly rateLimitState: 'ok' | 'throttled' | 'exhausted' | 'unknown'
}

export interface RawProductRecord {
  readonly network: string
  readonly externalProductId: string
  readonly title: string
  readonly categoryPath: readonly string[]
  readonly price: { amountMinor: number; currency: string } | null
  readonly originalPrice: { amountMinor: number; currency: string } | null
  readonly commissionRate: number | null
  readonly destinationCountry?: string
  readonly deliveryBucketDays?: number
  readonly raw: Record<string, unknown>
}

export interface Cursor {
  readonly offset: number
}

export interface ModuleContract {
  readonly id: string
  readonly network: string
  readonly sourceKind: SourceKind
  readonly capabilities: ModuleCapabilities
  /** MUST NOT be absent (SPEC-001 EC-9 / SPEC-003 FR-15). */
  readonly retentionPolicy: RetentionClass
  readonly rateLimits: RateLimits
  readonly identifierStrategy: string
  healthCheck(): Promise<HealthStatus>
  /** Fetch the next batch, or null when the source is exhausted. */
  fetchBatch(cursor: Cursor | null): Promise<{
    records: readonly RawProductRecord[]
    nextCursor: Cursor | null
  }>
}

/** Build a contract-checking error for missing/invalid requirements. */
export class ContractViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractViolation'
  }
}

/**
 * Validate that a ModuleContract is well-formed before the engine relies on it.
 * Fail fast at registration (SPEC-001 EC-9), not at the first write.
 */
export function assertValidContract(m: ModuleContract): void {
  if (!m.id.trim()) throw new ContractViolation('module id is required')
  if (!m.network.trim()) throw new ContractViolation('network is required')
  if (!m.capabilities) throw new ContractViolation('capabilities is required')
  if (!m.retentionPolicy || !(m.retentionPolicy.maxAgeDays > 0))
    throw new ContractViolation('retentionPolicy with maxAgeDays > 0 is required (FR-15)')
  if (!m.identifierStrategy.trim()) throw new ContractViolation('identifierStrategy is required')
  if (typeof m.healthCheck !== 'function') throw new ContractViolation('healthCheck() is required')
  if (typeof m.fetchBatch !== 'function') throw new ContractViolation('fetchBatch() is required')
}
