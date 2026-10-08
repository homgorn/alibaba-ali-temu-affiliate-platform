/**
 * Minimal HTTP API for product lookup. Zero dependencies: node:http.
 *
 * F014 — a product can be looked up by free-text query and by category filter
 * through a typed API. The typed layer is src/engine/api/lookup.ts; this file
 * is only the HTTP shell around it.
 *
 * This intentionally does NOT do TLS, auth, or rate limiting. It is a local /
 * internal read API. Production exposure, auth, and TLS belong to SPEC-004's
 * static deployment layer, not to this engine endpoint.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createSqliteRunner } from '../db/sqlite-runner.ts'
import { resolveRunner } from '../cli/migrate.ts'
import { loadEnv } from '../cli/migrate.ts'
import { searchProducts, parseLookupUrl, LookupInputError } from './lookup.ts'

export function startApi(port = 8080): void {
  loadEnv()
  const url = process.env.DATABASE_URL ?? 'file:./data/dev.db'
  const runner = resolveRunner(url)

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const u = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      const path = u.pathname.replace(/\/+$/, '') || '/'

      if (path === '/health') {
        send(res, 200, { status: 'ok', engine: runner.engine })
        return
      }
      if (path === '/products' || path === '/products/search') {
        let query
        try {
          query = parseLookupUrl(u)
        } catch (err) {
          if (err instanceof LookupInputError) {
            send(res, 400, { error: 'invalid_query', details: err.problems })
            return
          }
          throw err
        }
        const results = searchProducts(runner, query)
        send(res, 200, { count: results.length, query, results })
        return
      }
      send(res, 404, { error: 'not_found', path })
    } catch (err) {
      send(res, 500, { error: 'internal', message: (err as Error).message })
    }
  })

  server.listen(port, () => {
    console.log(`api listening on http://localhost:${port}`)
    console.log(`  GET /health`)
    console.log(`  GET /products?q=<term>&category=<name>&currency=USD&destination=US&limit=50&offset=0`)
  })
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body, null, 2))
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  startApi(Number(process.env.PORT ?? 8080))
}
