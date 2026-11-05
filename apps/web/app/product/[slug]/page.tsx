import type { Metadata } from 'next'
import Link from 'next/link'
import { allProducts, bySlug, type ProductCard } from '../../../lib/products'

export function generateStaticParams() {
  return allProducts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = bySlug(slug)
  if (!p) return {}
  return {
    title: p.title,
    description: `${p.title} — honest price and availability from the affiliate feed.`,
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p: ProductCard | undefined = bySlug(slug)

  if (!p) {
    return (
      <>
        <h1>Product not found</h1>
        <p>This page may have been removed from the feed, or the link is incorrect.</p>
        <p>
          <Link href="/catalog">Back to catalog</Link>
        </p>
      </>
    )
  }

  const price = p.price.amountMinor !== null ? (p.price.amountMinor / 100).toFixed(2) : 'Unknown'
  const currency = p.price.currency ?? '—'

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    category: p.categoryPath,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      url: p.detailUrl,
    },
  }

  return (
    <>
      <article data-page-kind="product" data-slug={p.slug}>
        <h1>{p.title}</h1>

        {p.monetisable ? (
          <span className="badge affiliate">Affiliate link — we may earn a commission</span>
        ) : (
          <span className="badge">Not monetised — no affiliate earnings on this item</span>
        )}

        <p>
          <strong>Price:</strong>{' '}
          {price === 'Unknown' ? 'Unknown — not in feed' : `${price} ${currency}`}
        </p>
        <p>
          <strong>Category:</strong> {p.categoryPath ?? 'Uncategorised'}
        </p>

        {p.monetisable ? (
          <p>
            <a href={p.detailUrl} rel="nofollow sponsored" target="_blank">
              View on merchant site
            </a>
          </p>
        ) : (
          <p className="muted">
            <a href={p.detailUrl} rel="nofollow" target="_blank">
              View on merchant site (non-affiliate)
            </a>
          </p>
        )}

        <p className="disclosure">
          We may receive a commission if you buy through this link, at no extra cost to you.
          Prices, shipping and availability change. Safety-critical categories are excluded
          from this site entirely.
        </p>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
      />

      <p>
        <Link href="/catalog">Back to catalog</Link>
      </p>
    </>
  )
}