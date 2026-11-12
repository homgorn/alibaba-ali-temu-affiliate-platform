# Runbook — Deploy + rollback (Cloudflare Pages)

**Scope:** the static site in `apps/web` (ADR-001/ADR-002) and, later, the
tracking Workers for the internal attribution tracker (ADR-005).

**State:** the Pages project does not exist yet. Everything required to stand
it up is in this repo. F025 remains open until a real deployment is verified
with smoke tests on the live URL (and recorded in BUILD_LOG.md).

---

## 1. Prerequisites (operator-owned)

1. A Cloudflare account that can pay from the operator's legal entity
   (КР ИП — payment acceptance from a Kyrgyz entity on Cloudflare is
   UNVERIFIED; see ADR-002). If Cloudflare Billing rejects it, the fallback
   is Vercel or Netlify (ADR-002), and this runbook must be adapted.
2. `wrangler` CLI OR the dashboard. Both are documented below.
3. `VISITOR_HASH_SALT` (production value, ≥ 32 chars) — generate once:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Set it in Pages → Settings → Environment variables, and in Workers when
   the attribution endpoints the engine serves locally move behind the edge.
   Reusing the dev salt in production links visitors between environments —
   it defeats FR-10.

4. `NEXT_PUBLIC_SITE_URL` set to the production site origin
   (`https://<subdomain>.pages.dev` until a custom domain is attached).

---

## 2. Create the Pages project

**Dashboard:** Workers & Pages → Create → Pages → Connect to Git →
`homgorn/alibaba-ali-temu-affiliate-platform`.

| Setting | Value |
|---|---|
| Root directory | `apps/web` |
| Build command | `pnpm --filter @affiliate/web build` |
| Build output directory | `out` |
| Environment variables | `NEXT_PUBLIC_SITE_URL`, `VISITOR_HASH_SALT` |

`_headers` and `functions/_middleware.ts` are picked up automatically:
`public/_headers` is copied by Next into `out/`; `_middleware.ts` runs at the
edge and emits the per-page `Link: <…>; rel="alternate"; type="text/markdown"`
header (SPEC-004 FR-10). Verify the header on a product page after the first
deploy:

```bash
curl -sI "https://<subdomain>.pages.dev/product/<slug>" | grep -i '^Link:'
# expect: Link: </product/<slug>.html.md>; rel="alternate"; type="text/markdown"
```

**CLI alternative:**

```bash
# from the repository root
npx wrangler@latest pages project create affiliate-platform --production-branch main
pnpm --filter @affiliate/web build
npx wrangler@latest pages deploy apps/web/out --project-name affiliate-platform
```

---

## 3. Smoke test (before announcing or linking the site)

```bash
curl -sI "https://<subdomain>.pages.dev/"                       # 200
curl -sI "https://<subdomain>.pages.dev/llms.txt"               # 200, Content-Type text/markdown
curl -s "https://<subdomain>.pages.dev/catalog" | grep -o        \
     'data-page-kind="product"'                                  # present
curl -sI "https://<subdomain>.pages.dev/product/<slug>.html.md"  # 200, text/markdown
curl -sI "https://<subdomain>.pages.dev/robots.txt"              # 200
curl -s "https://<subdomain>.pages.dev/robots.txt"               \
     | grep -c "OAI-SearchBot"                                    # >= 1 (FR-15)
curl -s "https://<subdomain>.pages.dev/sitemap.xml"               \
     | grep -c "/product/"                                        # 55
```

PASS criteria: all status 200, markdown content-type correct, HTML contains
`data-page-kind` (L7 guard), 55 product URLs in sitemap.

---

## 4. Rollback

Pages keeps every deployment immutable. Fastest:

```bash
npx wrangler@latest pages deployment list --project-name affiliate-platform
npx wrangler@latest pages deployment list --project-name affiliate-platform --json
```

Then either roll back in the dashboard (Pages → project → Deployments →
“Rollback to this deployment”) or redeploy the previous build:

```bash
git checkout <good-sha>
pnpm --filter @affiliate/web build
npx wrangler@latest pages deploy apps/web/out --project-name affiliate-platform \
     --branch main
git checkout main
```

**Cost budget:** rollback is free; nothing else in this runbook incurs API
spend. Budget checks: leave the project on the free Pages tier for the MVP.

---

## 5. Custom domain (subdomain)

The operator intends to front the site with a subdomain whose DNS is managed
at Spaceship (not the apex, which must never be modified). Steps once Pages
is live:

1. Pages → project → Custom domains → Add `app.example.com`.
2. Spaceship MCP: add a CNAME record `app` → `affiliate-platform.pages.dev`,
   TTL 3600, at the apex of the example.com zone ONLY (never the apex A/AAAA).
3. Wait for Pages to issue the certificate; check `curl -sI https://app.example.com/`.
4. Set `NEXT_PUBLIC_SITE_URL=https://app.example.com` and rebuild so
   canonical links, llms.txt URLs and sitemap emit the final origin.

---

## 6. What is deliberately NOT here

- No CI deploy (issue #8/D-033: Actions is billing-locked; pushing manually or
  from the operator's machine is the current path).
- No KV/D1/Data layer: the static export needs none; the attribution tracker
  (`src/engine/attribution`) is served locally and will move behind a Worker
  when F023 is taken on.