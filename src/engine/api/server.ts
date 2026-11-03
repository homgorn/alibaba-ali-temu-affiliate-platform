/**
 * Minimal HTTP API for product lookup + attribution. Zero dependencies: node:http.
 *
 * F014 — a product can be looked up by free-text query and by category filter
 * through a typed API. The typed layer is src/engine/api/lookup.ts; this file
 * is only the HTTP shell around it.
 *
 * F023 front-end — /click records an outbound click and 302-redirects (SPEC-005
 * FR-12: tracking MUST NOT block outbound navigation), /postback/:network records
 * an inbound network report (idempotent, EC-12), /api/epc reports earnings per
 * click per channel.
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
import { recordClick, ClickError } from '../attribution/click.ts'
import { recordConversion, PostbackError, type ConversionStatus } from '../attribution/postback.ts'
import { epcByChannel } from '../attribution/epc.ts'

const MAX_BODY_BYTES = 64 * 1024

function clientIp(req: IncomingMessage): string {
  // Behind a proxy, use x-forwarded-for (first hop only). Locally, socket.
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0]!.trim()
  return req.socket.remoteAddress ?? '0.0.0.0'
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = chunk as Buffer
    size += buf.length
    if (size > MAX_BODY_BYTES) {
      throw new Error(`request body too large (>${MAX_BODY_BYTES} bytes)`)
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function startApi(port = 8080): void {
  loadEnv()
  const url = process.env.DATABASE_URL ?? 'file:./data/dev.db'
  const runner = resolveRunner(url)

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const u = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      const path = u.pathname.replace(/\/+$/, '') || '/'
      const method = (req.method ?? 'GET').toUpperCase()

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

      // ------------------------------------------------ F023: /click redirect
      if (path === '/click') {
        const productId = u.searchParams.get('product_id') ?? u.searchParams.get('productId')
        const channel = u.searchParams.get('channel') ?? ''
        const to = u.searchParams.get('to')
        const destination = u.searchParams.get('destination') ?? undefined

        if (!productId || !channel || !to) {
          send(res, 400, { error: 'invalid_query', details: ['product_id, channel and to are required'] })
          return
        }
        // Open-redirect guard: only http(s) targets may be redirected to.
        let target: URL
        try {
          target = new URL(to)
          if (target.protocol !== 'http:' && target.protocol !== 'https:') {
            throw new Error(`protocol must be http or https, got ${target.protocol}`)
          }
        } catch {
          send(res, 400, { error: 'invalid_target', details: ['to must be an absolute http(s) URL'] })
          return
        }

        try {
          recordClick(runner, {
            productId,
            channel,
            destinationCountry: destination,
            sourceHost: req.headers.host?.split(':')[0] ?? '',
            ip: clientIp(req),
            userAgent: req.headers['user-agent'],
          })
        } catch (err) {
          // FR-12: never block the navigation. Log and still redirect.
          if (err instanceof ClickError) {
            console.error(`[click] not recorded: ${err.message}`)
          } else {
            console.error(`[click] recording failed: ${(err as Error).message}`)
          }
        }

        res.writeHead(302, { location: target.toString(), 'cache-control': 'no-store' })
        res.end()
        return
      }

      // --------------------------------------- F023: /postback/:network
      const postback = /^\/postback\/([a-z0-9_-]+)$/.exec(path)
      if (postback) {
        if (method !== 'POST' && method !== 'GET') {
          send(res, 405, { error: 'method_not_allowed', details: ['use POST or GET'] })
          return
        }
        let body: Record<string, unknown>
        try {
          body = u.searchParams.size > 0 ? Object.fromEntries(u.searchParams) : JSON.parse((await readBody(req)) || '{}')
        } catch {
          send(res, 400, { error: 'invalid_body', details: ['body must be JSON or query params'] })
          return
        }
        const amountRaw = body['amount_minor'] ?? body['amountMinor'] ?? body['commission_minor'] ?? body['commissionMinor']
        const amount = Number(amountRaw)
        try {
          const out = recordConversion(runner, {
            networkId: postback[1]!,
            externalOrderId: String(body['external_order_id'] ?? body['externalOrderId'] ?? ''),
            amountMinor: amount,
            currency: String(body['currency'] ?? 'USD'),
            clickId: (body['click_id'] as string | undefined) ?? (body['clickId'] as string | undefined),
            status: (body['status'] as ConversionStatus | undefined) ?? undefined,
          })
          send(res, out.created ? 201 : 200, out)
        } catch (err) {
          if (err instanceof PostbackError) {
            send(res, 400, { error: 'invalid_postback', details: [err.message] })
            return
          }
          throw err
        }
        return
      }

      // ------------------------------------------------ F023: /api/epc
      if (path === '/api/epc') {
        const currency = (u.searchParams.get('currency') ?? 'USD').toUpperCase()
        if (!/^[A-Z]{3}$/.test(currency)) {
          send(res, 400, { error: 'invalid_currency', details: [`currency must be ISO-4217, got "${currency}"`] })
          return
        }
        send(res, 200, epcByChannel(runner, currency))
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
    console.log(`  GET /click?product_id=<id>&channel=<channel>&to=<url>`)
    console.log(`  POST /postback/<network_id>   (JSON: external_order_id, amount_minor, currency, ...)`)
    console.log(`  GET /api/epc?currency=USD`)
  })
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body, null, 2))
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  startApi(Number(process.env.PORT ?? 8080))
}