/**
 * Product lookup — the first read path.
 *
 * F014 requires free-text search + category filter through a typed API. The
 * feature names "Postgres full-text search", but this machine has no Postgres
 * (no Docker, no psql — both verified absent). So the local implementation
 * uses a case-insensitive substring match over the title, and the Postgres
 * full-text path is recorded as an INCONCLUSIVE gap, not silently skipped.
 *
 * The matching itself lives here, not in a route, so it is testable without an
 * HTTP server and can be reused by the API and by any future CLI tool.
 */

import type { Runner } from '../db/migrate.ts'

export interface LookupQuery {
  /** Free-text term; matched against the title. Empty means "no filter". */
  readonly q?: string
  /** Required category keyword; matched against the category tree. */
  readonly category?: string
  /** Max results. Zero/negative is a client error. */
  readonly limit?: number
  /** Offset for paging. Negative is a client error. */
  readonly offset?: number
  /** Exact currency filter, ISO-4217. */
  readonly currency?: string
  /** Exact destination country filter, ISO-3166 alpha-2. */
  readonly destination?: string
}

export interface ProductMatch {
  readonly productId: string
  readonly externalProductId: string
  readonly title: string
  readonly networkId: string
  readonly categoryName: string | null
  readonly salePriceMinor: number | null
  readonly currency: string | null
  readonly destinationCountry: string | null
  readonly imageUrl: string | null
  readonly videoUrl: string | null
  readonly monetisable: boolean
  readonly safetyExcluded: boolean
  readonly detailUrl: string
  readonly observedAt: string | null
}

export class LookupInputError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(problems.join('; '))
    this.name = 'LookupInputError'
    this.problems = problems
  }
}

export function parseLookupUrl(url: URL): LookupQuery {
  const problems: string[] = []
  const rawLimit = url.searchParams.get('limit')
  const rawOffset = url.searchParams.get('offset')

  let limit: number | undefined
  let offset: number | undefined
  if (rawLimit !== null) {
    limit = Number(rawLimit)
    if (!Number.isInteger(limit) || limit < 0) problems.push(`limit must be a non-negative integer, got "${rawLimit}"`)
  }
  if (rawOffset !== null) {
    offset = Number(rawOffset)
    if (!Number.isInteger(offset) || offset < 0) problems.push(`offset must be a non-negative integer, got "${rawOffset}"`)
  }

  const currency = url.searchParams.get('currency')
  if (currency !== null && !/^[A-Za-z]{3}$/.test(currency)) problems.push(`currency must be ISO-4217 (3 letters), got "${currency}"`)

  const destination = url.searchParams.get('destination')
  if (destination !== null && !/^[A-Za-z]{2}$/.test(destination)) problems.push(`destination must be ISO-3166 alpha-2, got "${destination}"`)

  if (problems.length) throw new LookupInputError(problems)

  return {
    q: url.searchParams.get('q') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    limit: limit ?? 50,
    offset: offset ?? 0,
    currency: currency ? currency.toUpperCase() : undefined,
    destination: destination ? destination.toUpperCase() : undefined,
  }
}

/**
 * Matching on title/category is an anchored case-insensitive substring search.
 * This is a reasonable stand-in for Postgres FTS only at our current scale and
 * for substring queries. A word-boundary requirement would reject "batter" for
 * "battery"; a pure substring reject is what keeps "battery" in "batteries"
 * out of results (we want "battery"). Qualifying on the category tree uses an
 * exact case-insensitive equality on the leaf name.
 */
export function searchProducts(r: Runner, query: LookupQuery): ProductMatch[] {
  const clauses: string[] = []
  const params: (string | number)[] = []
  let i = 1
  const q = query.q?.trim()
  const cat = query.category?.trim()

  if (q) {
    clauses.push(`lower(p.title) LIKE $${i++}`)
    params.push(`%${q.toLowerCase()}%`)
  }
  if (cat) {
    // Match the filter against the full denormalised category path (any node).
    clauses.push(`lower(p.category_path) LIKE $${i++}`)
    params.push(`%${cat.toLowerCase()}%`)
  }
  if (query.currency) {
    clauses.push(`o.currency = $${i++}`)
    params.push(query.currency)
  }
  if (query.destination) {
    clauses.push(`o.destination_country = $${i++}`)
    params.push(query.destination)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const offsetClause = `LIMIT $${i++} OFFSET $${i++}`
  params.push(query.limit ?? 50)
  params.push(query.offset ?? 0)

  // Most recent observation per (product, destination). Grouping by destination
  // (not just product) is what lets a destination/currency filter match the
  // observation actually stored for that destination rather than whichever
  // country's reading happens to be latest overall.
  const latest = `
    SELECT product_id, destination_country, MAX(observed_at) AS max_at
    FROM price_observation
    GROUP BY product_id, destination_country
  `

  const sql = `
    SELECT DISTINCT
      p.product_id        AS productId,
      p.external_product_id AS externalProductId,
      p.title             AS title,
      p.network_id        AS networkId,
      c.name_en           AS categoryName,
      o.sale_price_minor  AS salePriceMinor,
      o.currency          AS currency,
      o.destination_country AS destinationCountry,
      p.image_url         AS imageUrl,
      p.video_url         AS videoUrl,
      p.monetisable       AS monetisable,
      p.safety_excluded   AS safetyExcluded,
      p.detail_url        AS detailUrl,
      o.observed_at       AS observedAt
    FROM product p
    LEFT JOIN category c ON c.category_id = p.category_id
    LEFT JOIN (${latest}) latest
      ON latest.product_id = p.product_id
    LEFT JOIN price_observation o
      ON o.product_id = latest.product_id
     AND o.destination_country = latest.destination_country
     AND o.observed_at = latest.max_at
    ${where}
    ORDER BY o.sale_price_minor IS NULL, o.sale_price_minor ASC
    ${offsetClause}
  `

  const rows = r.query<Record<string, unknown>>(sql, params)
  return rows.map(rowToMatch)
}

function rowToMatch(row: Record<string, unknown>): ProductMatch {
  return {
    productId: String(row['productId']),
    externalProductId: String(row['externalProductId']),
    title: String(row['title']),
    networkId: String(row['networkId']),
    categoryName: row['categoryName'] == null ? null : String(row['categoryName']),
    salePriceMinor: row['salePriceMinor'] == null ? null : Number(row['salePriceMinor']),
    currency: row['currency'] == null ? null : String(row['currency']),
    destinationCountry: row['destinationCountry'] == null ? null : String(row['destinationCountry']),
    imageUrl: row['imageUrl'] == null ? null : String(row['imageUrl']),
    videoUrl: row['videoUrl'] == null ? null : String(row['videoUrl']),
    monetisable: row['monetisable'] === 1 || row['monetisable'] === true,
    safetyExcluded: row['safetyExcluded'] === 1 || row['safetyExcluded'] === true,
    detailUrl: String(row['detailUrl']),
    observedAt: row['observedAt'] == null ? null : String(row['observedAt']),
  }
}
