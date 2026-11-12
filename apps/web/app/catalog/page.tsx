import type { Metadata } from 'next'
import Link from 'next/link'
import { allProducts } from '../../lib/products'

export const metadata: Metadata = {
  title: 'Catalog',
  description: 'Products ingested from affiliate feeds, safety-excluded items removed.',
  alternates: {
    types: {
      'text/markdown': '/catalog.html.md',
    },
  },
}

export default function CatalogPage() {
  const products = allProducts()
  return (
    <>
      <h1>Catalog</h1>
      <p className="muted">
        {products.length} products. Safety-critical categories are excluded entirely — not warned about.
      </p>
      <ul className="product-grid">
        {products.map((p) => (
          <li key={p.slug} className="card">
            {p.monetisable ? <span className="badge affiliate">Affiliate</span> : <span className="badge">No commission</span>}
            <Link href={`/product/${p.slug}`}>{p.title}</Link>
            <span className="muted">
              {p.categoryPath}
              {p.price.amountMinor !== null && (
                <>
                  {' · '}
                  {(p.price.amountMinor / 100).toFixed(2)} {p.price.currency}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
