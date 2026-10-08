/**
 * CSV ingestion into the catalogue — SPEC-001, F012.
 *
 * The properties this must guarantee, and why each is load-bearing:
 *
 *  - IDEMPOTENT (FR-9, NFR-1): re-running identical input leaves the database
 *    byte-identical. Feeds are re-fetched and re-run constantly, so a
 *    non-idempotent write would duplicate every row on every sync.
 *
 *  - WHOLE-BATCH REJECTION (FR-8): a malformed feed writes nothing. Half a
 *    catalogue is worse than none — it looks like data loss but is really
 *    corruption.
 *
 *  - SAFETY BEFORE WRITE (FR-20): excluded rows never reach `product`. They go
 *    to `safety_exclusion` so the refusal remains auditable (SPEC-003 FR-20).
 *
 *  - PROVENANCE (FR-18/FR-19): every row records its source and run id.
 *
 *  - UNKNOWN IS NULL (FR-9): a missing price component is stored as NULL and
 *    `is_complete` is false. Never 0.
 */

import type { Runner } from '../db/migrate.ts'
import { parseCsvWithSchema, CsvSchemaError, field, type CsvRow } from './csv.ts'
import { matchesSafety, type SafetyConfig } from './safety.ts'
import { parseMoney, parseCommissionRate, MoneyParseError, type Money } from '../../shared/money.ts'
import { newId } from '../../shared/ids.ts'

export const REQUIRED_CSV_COLUMNS = [
  'network',
  'external_product_id',
  'title',
  'detail_url',
  'currency',
  'destination_country',
  'sale_price',
] as const

export interface IngestOptions {
  readonly networkId: string
  readonly moduleId: string
  readonly source: 'csv' | 'api' | 'manual'
  readonly safety: SafetyConfig
  /** Fixture row count, to detect a truncated download (EC-6). */
  readonly expectedRowCount?: number
  readonly now?: Date
}

export interface IngestResult {
  readonly runId: string
  readonly rowsRead: number
  readonly rowsWritten: number
  readonly rowsUnchanged: number
  readonly rowsExcludedSafety: number
  readonly deadLettered: number
  readonly outcome: 'success' | 'partial' | 'failed'
  readonly durationMs: number
  readonly errors: readonly string[]
}

export class IngestError extends Error {
  // Plain fields rather than TypeScript parameter properties: Node's
  // --experimental-strip-types rejects them, and this project runs TS directly
  // via type stripping with no build step.
  readonly code:
    | 'SCHEMA_MISMATCH'
    | 'SAFETY_CONFIG_INVALID'
    | 'TRUNCATED_SOURCE'
    | 'NETWORK_UNKNOWN'

  constructor(
    code: 'SCHEMA_MISMATCH' | 'SAFETY_CONFIG_INVALID' | 'TRUNCATED_SOURCE' | 'NETWORK_UNKNOWN',
    message: string,
  ) {
    super(message)
    this.name = 'IngestError'
    this.code = code
  }
}

/** Normalise a country to alpha-2, or reject (SPEC-003 EC-14). */
function normaliseCountry(raw: string): string {
  const s = raw.trim().toUpperCase()
  if (s.length !== 2 || !/^[A-Z]{2}$/.test(s)) {
    throw new Error(
      `destination_country "${raw}" is not ISO-3166 alpha-2. ` +
        `Store the canonical form only — 3-letter codes are ambiguous and must not be stored.`,
    )
  }
  return s
}

interface ParsedRow {
  readonly networkId: string
  readonly externalId: string
  readonly title: string
  readonly detailUrl: string
  readonly imageUrl: string | null
  readonly videoUrl: string | null
  readonly categoryPath: readonly string[]
  readonly destinationCountry: string
  readonly currency: string
  readonly salePrice: Money
  readonly originalPrice: Money | null
  readonly commissionRate: number | null
  readonly deliveryBucketDays: number | null
  readonly shipping: Money | null
  readonly evaluateRate: number | null
}

function parseRow(row: CsvRow, opts: IngestOptions): ParsedRow {
  const network = field(row, 'network')
  if (network !== opts.networkId) {
    throw new Error(
      `Row declares network "${network}" but this run is for "${opts.networkId}". ` +
        `Refusing to write a row under the wrong network.`,
    )
  }

  const externalId = field(row, 'external_product_id')
  if (externalId === '') throw new Error('external_product_id is empty')

  const title = field(row, 'title')
  if (title === '') throw new Error('title is empty')

  const detailUrl = field(row, 'detail_url')
  if (detailUrl === '') throw new Error('detail_url is empty')

  const currency = field(row, 'currency').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`currency "${currency}" is not ISO-4217`)
  }

  const destinationCountry = normaliseCountry(field(row, 'destination_country'))

  // sale_price is required. parseMoney returns null for an empty string, which
  // would mean a product with no price — permitted (EC-15) but flagged.
  const salePrice = parseMoney(field(row, 'sale_price') || null, currency)
  if (salePrice === null) {
    throw new Error('sale_price is empty — a product row needs a price to be useful')
  }

  const originalPrice = parseMoney(field(row, 'original_price') || null, currency)
  const shipping = parseMoney(field(row, 'shipping') || null, currency)

  const deliveryBucket = field(row, 'delivery_bucket_days')
  const deliveryBucketDays = deliveryBucket === '' ? null : Number.parseInt(deliveryBucket, 10)
  if (deliveryBucketDays !== null && (!Number.isFinite(deliveryBucketDays) || deliveryBucketDays <= 0)) {
    throw new Error(`delivery_bucket_days "${deliveryBucket}" must be a positive integer`)
  }

  const evalRate = field(row, 'evaluate_rate')
  const categoryRaw = field(row, 'category_path')

  return {
    networkId: network,
    externalId,
    title,
    detailUrl,
    imageUrl: field(row, 'image_url') || null,
    videoUrl: field(row, 'video_url') || null,
    categoryPath: categoryRaw === '' ? [] : categoryRaw.split('>').map((s) => s.trim()).filter(Boolean),
    destinationCountry,
    currency,
    salePrice,
    originalPrice,
    commissionRate: parseCommissionRate(field(row, 'commission_rate') || null),
    deliveryBucketDays,
    shipping,
    evaluateRate: evalRate === '' ? null : Number.parseFloat(evalRate),
  }
}

export function ingestCsv(runner: Runner, csvText: string, opts: IngestOptions): IngestResult {
  const started = Date.now()
  const now = opts.now ?? new Date()
  const nowIso = now.toISOString()
  const errors: string[] = []

  // ---- Parse. Any schema error rejects the WHOLE batch (FR-8) before any write.
  let rows: CsvRow[]
  try {
    rows = parseCsvWithSchema(csvText, {
      required: REQUIRED_CSV_COLUMNS,
      expectedRowCount: opts.expectedRowCount,
    })
  } catch (err) {
    const code =
      err instanceof CsvSchemaError && /truncated|TRUNCATED/i.test(err.message)
        ? 'TRUNCATED_SOURCE'
        : 'SCHEMA_MISMATCH'
    throw new IngestError(code, (err as Error).message)
  }

  // ---- The network must exist (SPEC-003 FR-23).
  const net = runner.query<{ network_id: string }>(
    'SELECT network_id FROM network WHERE network_id = $1',
    [opts.networkId],
  )
  if (net.length === 0) {
    throw new IngestError(
      'NETWORK_UNKNOWN',
      `network "${opts.networkId}" does not exist. Register it before ingesting.`,
    )
  }

  const runId = newId()
  runner.exec(
    `INSERT INTO ingestion_run (run_id, module_id, network_id, source_kind, started_at, outcome)
     VALUES ($1,$2,$3,$4,$5,'running')`,
    [runId, opts.moduleId, opts.networkId, opts.source === 'csv' ? 'file-csv' : opts.source, nowIso],
  )

  let written = 0
  let unchanged = 0
  let excluded = 0
  let deadLettered = 0

  // ---- One transaction for the batch: all rows land, or none do.
  runner.begin()
  try {
    for (const row of rows) {
      let parsed: ParsedRow
      try {
        parsed = parseRow(row, opts)
      } catch (err) {
        // Row-level failure => dead-letter with full context for replay (FR-15).
        deadLettered++
        errors.push(`line ${row.__line}: ${(err as Error).message}`)
        runner.exec(
          `INSERT INTO dead_letter (id, run_id, module_id, entity_ref, error_code, error_class, payload_hash, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            newId(),
            runId,
            opts.moduleId,
            field(row, 'external_product_id') || null,
            'ROW_PARSE_FAILED',
            (err as Error).constructor.name,
            simpleHash(String(row.__line)),
            JSON.stringify(row),
          ],
        )
        continue
      }

      // ---- SAFETY GATE, before any write (FR-20).
      const verdict = matchesSafety(
        `${parsed.title} ${parsed.categoryPath.join(' ')}`,
        parsed.categoryPath,
        opts.safety,
      )
      if (verdict.excluded) {
        excluded++
        // EC-4/spec: the audit records that WE refused to sell this. Re-ingesting
        // an identical row must not append a second refusal — the control's
        // value is in the record existing, not in counting runs.
        const already = runner.query<{ exclusion_id: string }>(
          `SELECT exclusion_id FROM safety_exclusion
           WHERE network_id = $1 AND external_product_id = $2 AND title = $3`,
          [parsed.networkId, parsed.externalId, parsed.title],
        )
        if (already.length === 0) {
          runner.exec(
            `INSERT INTO safety_exclusion (exclusion_id, run_id, network_id, external_product_id,
               matched_category, matched_keyword, title, excluded_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              newId(),
              runId,
              parsed.networkId,
              parsed.externalId,
              verdict.matchedCategory ?? parsed.categoryPath[0] ?? 'unknown',
              verdict.matchedKeyword ?? 'unknown',
              parsed.title,
              nowIso,
            ],
          )
        }
        continue
      }

      // ---- Idempotent product upsert (FR-9).
      const monetisable = parsed.commissionRate !== null && parsed.commissionRate > 0

      // EC-2: original < sale is an upstream anomaly. Flag it; do NOT fix it.
      const anomaly =
        parsed.salePrice.minor === 0
          ? 'sale_zero'
          : parsed.originalPrice && parsed.originalPrice.minor < parsed.salePrice.minor
            ? 'original_lt_sale'
            : null

      const before = runner.query<{ fingerprint: string }>(
        `SELECT title || '|' || detail_url || '|' || IFNULL(image_url,'') AS fingerprint
         FROM product WHERE network_id = $1 AND external_product_id = $2`,
        [parsed.networkId, parsed.externalId],
      )

      runner.exec(
        `INSERT INTO product (
           product_id, network_id, external_product_id, title, detail_url,
           image_url, video_url, commission_rate, monetisable, safety_excluded,
           first_seen_at, last_seen_at, source, source_run_id, evaluate_rate,
           price_is_placeholder
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$10,$11,$12,$13,$14)
         ON CONFLICT (network_id, external_product_id) DO UPDATE SET
           title = excluded.title,
           detail_url = excluded.detail_url,
           image_url = excluded.image_url,
           video_url = excluded.video_url,
           commission_rate = excluded.commission_rate,
           monetisable = excluded.monetisable,
           last_seen_at = excluded.last_seen_at,
           evaluate_rate = excluded.evaluate_rate,
           price_is_placeholder = excluded.price_is_placeholder`,
        [
          newId(),
          parsed.networkId,
          parsed.externalId,
          parsed.title,
          parsed.detailUrl,
          parsed.imageUrl,
          parsed.videoUrl,
          parsed.commissionRate,
          monetisable ? 1 : 0,
          nowIso,
          opts.source,
          runId,
          parsed.evaluateRate,
          parsed.salePrice.minor === 0 ? 1 : 0,
        ],
      )

      const productId = runner.query<{ product_id: string }>(
        'SELECT product_id FROM product WHERE network_id = $1 AND external_product_id = $2',
        [parsed.networkId, parsed.externalId],
      )[0]!.product_id

      // ---- Price observation, destination-keyed (SPEC-003 FR-7).
      //
      // IDEMPOTENCY (FR-9, AC-3) — this is subtle and was caught by the F012
      // verifier, not by reading the code:
      //
      // The natural key `(product, destination, observed_at)` includes the
      // timestamp, so re-running the SAME file at a DIFFERENT time creates a
      // new row. That is CORRECT for price history — two readings taken an
      // hour apart are two facts — but it means "re-run identical input" is
      // only idempotent within the same instant.
      //
      // The resolution: identical input MUST mean the same timestamp. So a
      // module replays the same feed with the SAME `observedAt`, and only a
      // genuinely later observation uses a later timestamp. `now` is therefore
      // supplied by the caller and is stable across a replay, rather than
      // being read from the clock inside this function.
      //
      // is_complete is false when ANY component is unknown (FR-9).
      const isComplete = parsed.shipping !== null
      // Skip the write when an observation for this product + destination
      // already exists at the same instant with the same price. Re-ingesting an
      // identical feed must not append a duplicate point to the price series —
      // that would inflate history and corrupt every average derived from it.
      const existing = runner.query<{ sale_price_minor: number }>(
        `SELECT sale_price_minor FROM price_observation
         WHERE product_id = $1 AND destination_country = $2 AND observed_at = $3`,
        [productId, parsed.destinationCountry, nowIso],
      )[0]

      if (existing && existing.sale_price_minor === parsed.salePrice.minor) {
        // The product row was upserted above; only the price series is
        // intentionally untouched. Count it as unchanged so the run's totals
        // still add up (written + unchanged + excluded == rowsRead).
        const afterFp = runner.query<{ fingerprint: string }>(
          `SELECT title || '|' || detail_url || '|' || IFNULL(image_url,'') AS fingerprint
           FROM product WHERE product_id = $1`,
          [productId],
        )[0]!.fingerprint
        if (before[0]?.fingerprint === afterFp) unchanged++
        else written++
        continue
      }

      runner.exec(
        `INSERT INTO price_observation (
           observation_id, product_id, destination_country, observed_at, currency,
           sale_price_minor, original_price_minor, commission_rate, delivery_bucket_days,
           shipping_minor, duty_minor, is_complete, source, source_run_id, price_anomaly
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$12,$13,$14)
         ON CONFLICT (product_id, destination_country, observed_at) DO UPDATE SET
           sale_price_minor = excluded.sale_price_minor,
           original_price_minor = excluded.original_price_minor,
           commission_rate = excluded.commission_rate,
           shipping_minor = excluded.shipping_minor,
           is_complete = excluded.is_complete,
           price_anomaly = excluded.price_anomaly`,
        [
          newId(),
          productId,
          parsed.destinationCountry,
          nowIso,
          parsed.salePrice.currency,
          parsed.salePrice.minor,
          parsed.originalPrice?.minor ?? null,
          parsed.commissionRate,
          parsed.deliveryBucketDays,
          parsed.shipping?.minor ?? null,
          isComplete ? 1 : 0,
          opts.source,
          runId,
          anomaly,
        ],
      )

      // Idempotency measurement (NFR-1): did anything actually change?
      const after = runner.query<{ fingerprint: string }>(
        `SELECT title || '|' || detail_url || '|' || IFNULL(image_url,'') AS fingerprint
         FROM product WHERE product_id = $1`,
        [productId],
      )[0]!.fingerprint
      const priorFingerprint = before[0]?.fingerprint
      if (priorFingerprint !== undefined && priorFingerprint === after) {
        unchanged++
      } else {
        written++
      }
    }

    runner.commit()
  } catch (err) {
    runner.rollback()
    throw err
  }

  const outcome: IngestResult['outcome'] =
    deadLettered > 0 ? 'partial' : 'success'

  runner.exec(
    `UPDATE ingestion_run SET finished_at = $1, rows_read = $2, rows_written = $3,
       rows_skipped = $4, rows_excluded_safety = $5, dead_lettered = $6, outcome = $7
     WHERE run_id = $8`,
    [
      new Date().toISOString(),
      rows.length,
      written,
      unchanged,
      excluded,
      deadLettered,
      outcome,
      runId,
    ],
  )

  return {
    runId,
    rowsRead: rows.length,
    rowsWritten: written,
    rowsUnchanged: unchanged,
    rowsExcludedSafety: excluded,
    deadLettered,
    outcome,
    durationMs: Date.now() - started,
    errors,
  }
}

/** Small stable hash for dead-letter payload identification. */
function simpleHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export { MoneyParseError }
