import type { Metadata } from 'next'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.pages.dev'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Affiliate Price Intelligence',
    template: '%s · Affiliate Price Intelligence',
  },
  alternates: {
    types: {
      'text/markdown': '/index.html.md',
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav aria-label="Top navigation">
            <a href="/">Home</a>
            <a href="/catalog">Catalog</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            <a href="/llms.txt">llms.txt</a> · <a href="/robots.txt">robots.txt</a> ·{' '}
            <a href="/sitemap.xml">sitemap.xml</a>
          </p>
          <p>
            Affiliate links earn a commission at no extra cost to you. Prices and availability
            are volatile — always check the merchant page before buying.
          </p>
        </footer>
      </body>
    </html>
  )
}