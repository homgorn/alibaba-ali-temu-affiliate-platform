import type { Metadata } from 'next'
import Link from 'next/link'
import { allProducts } from '../lib/products'

export const metadata: Metadata = {
  title: 'Home',
  description: 'Affiliate price intelligence: honest price history and landed cost.',
}

export default function HomePage() {
  const products = allProducts()
  const sample = products.slice(0, 6)

  return (
    <>
      <h1>Affiliate Price Intelligence</h1>
      <p>
        Give people an answer they cannot get from a search engine — and earn from it.
        We show real price history, flag fake discounts, and say when a total cannot be trusted.
      </p>

      <h2>Sample from the current feed</h2>
      <ul className="product-grid">
        {sample.map((p) => (
          <li key={p.slug} className="card">
            {p.monetisable ? <span className="badge affiliate">Affiliate</span> : <span className="badge">No commission</span>}
            <Link href={`/product/${p.slug}`}>{p.title}</Link>
            <span className="muted">{p.categoryPath}</span>
          </li>
        ))}
      </ul>

      <p className="notice">
        This site is a work in progress. Product data shown is a sample; full catalogue arrives
        once the live AliExpress feed is connected (issue #1).
      </p>
    </>
  )
}