# ADR-002 — Hosting: Cloudflare Pages + Workers

| Field | Value |
|---|---|
| **Status** | Accepted, **with two unverified risks** |
| **Date** | 2026-10-08 |
| **Deciders** | operator |
| **Relates to** | D-010, SPEC-004, risk R-016 |

## Context

The site must serve static HTML globally, expose a small lookup API, and set a
`Link:` response header advertising `.md` twins. The operator's legal entity is a
registered Russian business, and payment accessibility from that entity is not
guaranteed for every provider.

## Decision

**Cloudflare Pages (static site) + Workers (lookup API + dynamic routes).**

## Alternatives considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Cloudflare Pages + Workers** | Static HTML at the edge; Workers in the same runtime; free tier is generous; **can set arbitrary response headers at the CDN level** (satisfies SPEC-004 FR-10); R2 for fixtures; no cold-start problem for static | Worker runtime differs from Node (no full `node:*` API surface); payment availability from a Russian entity is **unverified** | ✅ **Chosen** |
| **Vercel** | Best-in-class Next.js DX; zero-config; preview deploys per PR | Vendor lock-in; serverless function limits; **payment/access risk from a Russian entity** — a concern with several providers | ❌ |
| **Netlify** | Good static + edge; reasonable Next.js support | Less Next.js-native than Vercel; same payment concern | ❌ |
| **Self-hosted VPS** | Total control; no vendor payment risk; unrestricted egress | Adds ops burden (TLS, updates, backups, monitoring) to a one-person operation | ❌ for now |

## Consequences

**Positive**
- The `Link:` header can be configured once at the edge and will cover every page
  including `.md` resources — precisely what FR-10 asks for. This was the
  deciding technical factor.
- Zero cold starts on static pages; the LCP target (NFR-4, < 1.5 s) is achievable
  globally.
- Free tier should cover start scale (50k products, §2 of SPEC-003).

**Negative**
- Worker runtime constraints will shape the lookup API's shape. Not a problem
  for a read-only JSON API, but it means no arbitrary Node libraries server-side.
- Build times for 10k pages (NFR-6, < 10 min) are **unverified** on Pages.
- Migration away from Cloudflare would mean re-implementing edge header config.

## ⚠️ UNVERIFIED — must be resolved before Phase 4

1. **Does Cloudflare Pages accept payment from the operator's legal entity?**
   If not, the entire choice fails and Netlify/Vercel/self-hosted must be
   re-evaluated. This is a **1-minute check** and it gates the decision.
2. **Can Workers reach the AliExpress affiliate API?** Some affiliate APIs block
   datacenter IP ranges. If Cloudflare's egress ranges are blocked, ingestion must
   run from elsewhere and Workers becomes read-only. Test early — it changes the
   architecture (ingestion location vs serving location become independent).
3. **Does the Pages build fit the NFR-6 10-minute budget** at 10k pages?

## Revisit when

- Any of the three UNVERIFIED items resolves unfavourably.
- Traffic outgrows the free tier in a way that makes cost-per-request material.
