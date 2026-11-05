/** @type {import('next').NextConfig} */
const nextConfig = {
  // ADR-001 — static export. Every page builds to plain HTML on disk.
  // This is a hard guarantee, not a convenience: client-side rendering can
  // enhance, but it can never be the source of primary content (SPEC-004).
  output: 'export',

  // Product images are served by the affiliate network CDNs, so this app
  // does no image optimisation of its own.
  images: { unoptimized: true },

  // FR-25 — build-time size budget for product pages (< 100 KB HTML).
  // Enforced by scripts/verify-site.mjs, not by this config.
  trailingSlash: false,

  // The `.md` twin convention: page.html.md (extension appended). These are
  // build-time artifacts produced by scripts/generate-md-twins.mjs into
  // out/ alongside the HTML, so the export works as a static site.
}

export default nextConfig