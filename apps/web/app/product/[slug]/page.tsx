import type { Metadata } from 'next'
import Link from 'next/link'
import { allProducts, bySlug, type ProductCard } from '../../../lib/products'
import { computeLandedCost } from '../../../lib/landed-cost'

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

  const landed = computeLandedCost({
    itemMinor: p.price.amountMinor,
    itemCurrency: currency,
    itemSource: 'feed',
    shippingMinor: p.shippingMinor,
    shippingCurrency: p.shippingCurrency ?? currency,
    shippingSource: p.shippingMinor === null ? 'unknown' : 'feed',
    dutyMinor: null,
    dutyCurrency: currency,
    dutySource: 'unknown',
    vatMinor: null,
    vatCurrency: currency,
    vatSource: 'unknown',
    handlingMinor: null,
    handlingCurrency: currency,
    handlingSource: 'unknown',
  })

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

        <section className="cost-block" aria-label="Cost breakdown">
          <h2>What this costs</h2>
          <table>
            <tbody>
              <tr>
                <th>Item price</th>
                <td>{price === 'Unknown' ? 'Unknown — not in feed' : `${price} ${currency}`}</td>
              </tr>
              <tr>
                <th>Shipping</th>
                <td>{p.shippingMinor !== null ? `${(p.shippingMinor / 100).toFixed(2)} ${p.shippingCurrency}` : 'Unknown — not in feed'}</td>
              </tr>
              <tr>
                <th>Duty / customs</th>
                <td>Unknown — no tariff data for this country + category</td>
              </tr>
              <tr>
                <th>VAT / sales tax</th>
                <td>Unknown — no rate table for this destination</td>
              </tr>
              <tr>
                <th>Handling / broker fees</th>
                <td>Unknown — not in feed</td>
              </tr>
              <tr>
                <th>Estimated total</th>
                <td>
                  {landed.totalMinor !== null
                    ? `${(landed.totalMinor / 100).toFixed(2)} ${landed.currency}`
                    : 'Cannot be computed — some components are unknown'}
                </td>
              </tr>
            </tbody>
          </table>
          {!landed.isComplete && (
            <p className="notice">
              This total is <strong>incomplete</strong>. The following are unknown and are
              NOT included in any number above: {landed.unknown.join(', ')}.
              The item price alone is known; the rest must be confirmed on the
              merchant page before buying.
            </p>
          )}
          {p.deliveryBucketDays !== null && (
            <p className="muted">Estimated delivery: {p.deliveryBucketDays} days.</p>
          )}
        </section>

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