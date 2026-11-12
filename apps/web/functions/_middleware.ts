/**
 * Cloudflare Pages Function — runs on every request to the static site.
 *
 * Purpose (SPEC-004 FR-9/FR-10): every public page must advertise its `.md`
 * twin via HTTP `Link:` header so AI agents can discover the markdown copy
 * without parsing HTML. Static `_headers` files cannot compute per-page
 * paths, so this middleware does it.
 *
 * Only emits the header for paths that have a twin on disk:
 *   /                  -> /index.html.md
 *   /catalog           -> /catalog.html.md
 *   /product/<slug>    -> /product/<slug>.html.md
 * Anything else gets no header (and no fabrication).
 */

export const onRequest = async (context: { request: Request; next: () => Promise<Response> }) => {
  const response = await context.next()
  const url = new URL(context.request.url)

  const path = url.pathname.replace(/\/+$/, '') || '/'
  let twin: string | null = null
  if (path === '/') twin = '/index.html.md'
  else if (path === '/catalog') twin = '/catalog.html.md'
  else {
    const product = /^\/product\/([a-zA-Z0-9_-]+)$/.exec(path)
    if (product) twin = `/product/${product[1]}.html.md`
  }

  if (twin) {
    const headers = new Headers(response.headers)
    headers.set('Link', `<${twin}>; rel="alternate"; type="text/markdown"`)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
  return response
}