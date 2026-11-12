/**
 * Independent verification of F025 — deployed site + documented rollback.
 *
 * Checks the deployed site over HTTPS (no local DB), and the rollback
 * contract from docs/runbooks/DEPLOY.md. The deploy and the drill steps were
 * EXECUTED during the 2026-11-12 session (evidenced in the conversation);
 * this verifier re-checks the deployed site right now.
 *
 * Exit 0 on VERIFIED, 1 otherwise.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const BASE = process.env.SMOKE_BASE_URL ?? 'https://baba-express.pages.dev'

const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string) {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
}

const runbook = readFileSync(join(ROOT, 'docs/runbooks/DEPLOY.md'), 'utf8')
check('F025  rollback procedure written in runbook (step 5)', /pages deployment list/.test(runbook) && /redeploy/.test(runbook), 'DEPLOY.md contains deployment-list + redeploy rollback')

async function main() {
  const home = await fetch(`${BASE}/`)
  const homeBody = await home.text()
  check('F025  deployed URL renders the site (step 2)', home.status === 200 && homeBody.includes('Affiliate Price Intelligence'), `status=${home.status} bytes=${homeBody.length}`)

  const catalog = await fetch(`${BASE}/catalog`)
  const catalogBody = await catalog.text()
  check('F025  product pages exist on the deployed domain', catalog.status === 200 && /\/product\/\d+/.test(catalogBody), `status=${catalog.status}`)

  const product = await fetch(`${BASE}/product/33006951783`)
  const productBody = await product.text()
  check('F025  product page includes title + affiliate link', product.status === 200 && productBody.includes('Wireless Bluetooth Earbuds') && productBody.includes('rel="nofollow sponsored"'), `status=${product.status}`)

  const md = await fetch(`${BASE}/product/33006951783.html.md`)
  const mdBody = await md.text()
  const mdOk = md.status === 200 && mdBody.includes('Wireless Bluetooth Earbuds') && mdBody.includes('18.50')
  check('F025  .md twin served with same facts (step 3)', mdOk, `status=${md.status} content-type=${md.headers.get('content-type')}`)

  const mdType = md.headers.get('content-type') ?? ''
  check('F025  .md twin served as markdown', /markdown/i.test(mdType), mdType)

  const llms = await fetch(`${BASE}/llms.txt`).then((r) => r.text())
  const canonical = (process.env.CANONICAL_URL ?? 'https://baba-express.r00m.ru').replace(/\/+$/, '')
  const productLinks = [...llms.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).filter((l) => /\/product\/\d+$/.test(l))
  check('F025  llms.txt ships 55 product links pointing at the canonical site',
    productLinks.length === 55 && productLinks.every((l) => l.startsWith(`${canonical}/product/`)),
    `${productLinks.length} links; expected prefix ${canonical}/product/`)

  // DNS for the canonical subdomain cannot be verified until the operator adds
  // the CNAME (Cloudflare Pages token is intentionally Pages-only). We probe it,
  // but do not gate the verdict on it — this is INCONCLUSIVE, not PASS.
  try {
    const probe = await fetch(productLinks[0]!, { method: 'HEAD' })
    console.log(`      INCONCLUSIVE  canonical domain probe: status=${probe.status} (DNS/Pages validation may be pending)`)
  } catch (e) {
    console.log(`      INCONCLUSIVE  canonical domain probe failed: ${(e as Error).message.split('\n')[0]} (operator must add CNAME)`)
  }

  const head = await fetch(`${BASE}/product/33006951783`, { method: 'HEAD' })
  const link = head.headers.get('Link') ?? ''
  check('F025  Link header advertises .md twin (SPEC-004 FR-10)', link.includes('33006951783.html.md') && link.includes('text/markdown'), link)

  const failed = results.filter((r) => !r.ok)
  const verdict = failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'
  console.log(`\n=== VERDICT: ${verdict} (${results.length - failed.length}/${results.length}) ===`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
