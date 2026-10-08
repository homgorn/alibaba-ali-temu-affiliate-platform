/**
 * createCsvModule — the reference adapter proving ModuleContract is realizable.
 *
 * A feed from a file/CSV satisfies ModuleContract just like a live API does
 * (SPEC-001 FR-6). This is what lets Temu — verified to have no public API —
 * and any future curated source plug into the same ingestion engine, with no
 * special case in the engine.
 */

import { readFileSync } from 'node:fs'
import {
  type ModuleContract,
  type RawProductRecord,
  type Cursor,
  type HealthStatus,
  assertValidContract,
} from './module.ts'
import { parseCsvWithSchema, field } from './ingest/csv.ts'
import { parseMoney, parseCommissionRate } from '../shared/money.ts'
import { REQUIRED_CSV_COLUMNS } from './ingest/ingest-csv.ts'

export interface CsvModuleOptions {
  readonly path: string
  readonly network?: string
  readonly id?: string
  /** Batch size. fetchBatch is called repeatedly until it returns exhausted. */
  readonly batchSize?: number
}

export function createCsvModule(opts: CsvModuleOptions): ModuleContract {
  const batchSize = opts.batchSize ?? 100
  const network = opts.network ?? 'aliexpress'

  // Split into rows up front; the cursor is an offset into this pre-parsed list.
  // This keeps fetchBatch deterministic and the source re-readable.
  let cache: RawProductRecord[] | null = null

  function load(): RawProductRecord[] {
    if (cache) return cache
    const text = readFileSync(opts.path, 'utf8')
    const rows = parseCsvWithSchema(text, { required: REQUIRED_CSV_COLUMNS })
    cache = rows.map((row) => ({
      network: field(row, 'network') || network,
      externalProductId: field(row, 'external_product_id'),
      title: field(row, 'title'),
      categoryPath: field(row, 'category_path').split('>').map((s) => s.trim()).filter(Boolean),
      price: (() => {
        const c = field(row, 'currency').toUpperCase() || 'USD'
        const pc = parseMoney(field(row, 'sale_price'), c)
        return pc ? { amountMinor: pc.minor, currency: pc.currency } : null
      })(),
      originalPrice: (() => {
        const c = field(row, 'currency').toUpperCase() || 'USD'
        const po = parseMoney(field(row, 'original_price'), c)
        return po ? { amountMinor: po.minor, currency: po.currency } : null
      })(),
      commissionRate: parseCommissionRate(field(row, 'commission_rate') || null),
      destinationCountry: field(row, 'destination_country').toUpperCase() || undefined,
      deliveryBucketDays: field(row, 'delivery_bucket_days') ? Number(field(row, 'delivery_bucket_days')) : undefined,
      raw: row as unknown as Record<string, unknown>,
    }))
    return cache
  }

  return {
    id: opts.id ?? `csv:${network}`,
    network,
    sourceKind: 'file-csv',
    capabilities: {
      supportsProductFeed: true,
      supportsDeepLinks: false,
      supportsConversionReporting: false,
      supportsBulkDownload: true,
    },
    retentionPolicy: { name: 'catalogue', maxAgeDays: 30, basis: 'operator-review' },
    rateLimits: { requestsPerDay: Number.MAX_SAFE_INTEGER },
    identifierStrategy: 'external_product_id',
    async healthCheck(): Promise<HealthStatus> {
      try {
        load()
        return { reachable: true, lastSuccessAt: new Date(), rateLimitState: 'ok' }
      } catch {
        return { reachable: false, lastSuccessAt: null, rateLimitState: 'unknown' }
      }
    },
    async fetchBatch(cursor: Cursor | null) {
      const all = load()
      const start = cursor ? cursor.offset : 0
      const records = all.slice(start, start + batchSize)
      const nextOffset = start + records.length
      const nextCursor: Cursor | null = nextOffset >= all.length ? null : { offset: nextOffset }
      return { records, nextCursor }
    },
  }
}

export { assertValidContract }
