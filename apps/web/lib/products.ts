/**
 * Product data for the static site.
 *
 * The site is built from the database at build time (SPEC-004 FR-3), via
 * apps/web/scripts/export-products.mjs, which writes apps/web/data/products.json
 * through the same ingestion pipeline the engine tests use.
 *
 * Every product row contains exactly what the UI needs. Unknowns are NULL
 * strings and are rendered as "Unknown" — never as 0.
 *
 * The exported JSON is not in git: it is a build artifact. Run
 * `pnpm --filter @affiliate/web export:products` before building.
 */

import data from '../data/products.json'

export interface ProductCard {
  readonly slug: string
  readonly title: string
  readonly networkId: string
  readonly categoryPath: string | null
  readonly price: { currency: string; amountMinor: number | null }
  readonly monetisable: boolean
  readonly detailUrl: string
}

export function allProducts(): ProductCard[] {
  return data.products as unknown as ProductCard[]
}

export function bySlug(slug: string): ProductCard | undefined {
  return allProducts().find((p) => p.slug === slug)
}