# Open-Source Self-Hosted Trackers — Detailed Analysis

## Summary Table

| Project | License | Stars | Commits | Status | Stack | S2S/Postback | AliExpress Ready |
|---------|---------|-------|---------|--------|-------|--------------|------------------|
| AffEasy | AGPL-3.0 | ~500 | 3,133 | Active | Next.js, TS, Upstash, PlanetScale | Postback API claimed | ❌ No template |
| RefearnApp | AGPL-3.0 | ~200 | 1,400 | Active | Next.js, Cloudflare Edge, Drizzle | Postback for own network | ❌ Referral only |
| Cliq | Unclear | ~50 | 254 | Early | NestJS, Angular, Prisma | Referral tracking | ❌ No |
| RefRef | AGPL-3.0 | 191 | 113 | **Alpha** | Next.js, Drizzle, PG | Referral attribution | ❌ "Expect bugs" |
| Affiliate Postback Engine | MIT | ~20 | 53 | MVP | Next.js, Express, PG | S2S postback MVP | ❌ No templates |
| Affiliate Tracking | Unspecified | ~10 | ~50 | Early | React, Express, PG | Basic postback | ❌ No |

---

## Detailed Analysis

### AffEasy (afftester/affeasy)

**Source:** github.com/afftester/affeasy
**Retrieved:** 2026-11-03
**Type:** reported (GitHub repo + README)

- **License:** AGPL-3.0 (viral — any SaaS deployment must open-source modifications)
- **Description:** "The only open source Affiliate Marketing Platform that allows you to create affiliate links from every major affiliate network"
- **Stack:** Next.js, TypeScript, Tailwind, Upstash (Redis), PlanetScale (MySQL), Tinybird (analytics), NextAuth, BoxyHQ (SSO), Turborepo, Stripe, Postmark, Vercel
- **Self-hosting guide:** Links to guide (not verified)
- **Network support claim:** "Unified Network Access" — create affiliate links from every major network
- **Postback:** Mentioned in features but no AliExpress-specific template found
- **Risk:** AGPL-3.0 viral. If we deploy as SaaS (even internal), must open-source our modifications. **Incompatible with proprietary product.**

### RefearnApp (ZAK123DSFDF/refearnapp)

**Source:** github.com/ZAK123DSFDF/refearnapp
**Retrieved:** 2026-11-03
**Type:** reported (GitHub repo + README)

- **License:** AGPL-3.0 (viral)
- **Description:** "Open-source & self-hostable alternative to Rewardful, FirstPromoter, and Tolt" — **referral program** tracker, not affiliate network tracker
- **Stack:** Next.js, Cloudflare Edge, Drizzle, Docker
- **Postback:** Has `app.min.js` for cookie-based click tracking, postback endpoint for their own network (`postback.affmates.com`)
- **Use case:** Run your own referral/affiliate program, not track external networks
- **Risk:** AGPL-3.0 viral. Wrong use case.

### Cliq (org-quicko/cliq)

**Source:** github.com/org-quicko/cliq
**Retrieved:** 2026-11-03
**Type:** reported (GitHub repo + README)

- **License:** Not clearly stated in README
- **Description:** "Self-hosted affiliate software for startups" — promoter/affiliate management
- **Stack:** NestJS (API), Angular (frontend), TypeORM/Prisma, PostgreSQL, Docker
- **Features:** Affiliate/promoter management, referral tracking, commission calculation, reporting
- **Postback:** Not documented for external networks
- **Status:** Early (254 commits, 2025-03 start)

### RefRef (refrefhq/refref / amicalhq/refref)

**Source:** github.com/refrefhq/refref, github.com/amicalhq/refref
**Retrieved:** 2026-11-03
**Type:** reported (GitHub repos + README)

- **License:** AGPL-3.0 (viral)
- **Status:** **Alpha** — "expect bugs and breaking changes"
- **Commits:** 113 (started 2025-02)
- **Stack:** Next.js, React, Tailwind, Drizzle, PostgreSQL, Better-Auth, Zod, Vitest, Turborepo
- **Features:** Referral attribution (JS snippet), customizable rewards, referrer/partner portals, personalized pages, nudges, fraud monitoring, manual/auto reward approval
- **Postback:** Referral attribution via JS snippet + partner postbacks
- **Risk:** Alpha + AGPL-3.0. Not production-ready.

### Affiliate Postback Engine (UjjwalSaini07/Affiliate-Postback-Engine)

**Source:** github.com/UjjwalSaini07/Affiliate-Postback-Engine
**Retrieved:** 2026-11-03
**Type:** reported (GitHub repo + README)

- **License:** MIT (permissive ✅)
- **Status:** MVP (53 commits, started 2025-08)
- **Stack:** Next.js, Express, PostgreSQL, nginx, Docker
- **Features:** Click logging, S2S postback, dashboard
- **API:** `/api/click` (click tracking), `/api/postback` (conversion), `/api/affiliate/{id}/clicks|conversions`
- **Postback:** Basic S2S implementation. No network templates.
- **Use case:** Learning/extending, not production affiliate network tracking.

### Affiliate Tracking (programmer2807/Affiliate_Tracking)

**Source:** github.com/programmer2807/Affiliate_Tracking
**Retrieved:** 2026-11-03
**Type:** reported (GitHub repo + README)

- **License:** Unspecified in search results
- **Stack:** React, TypeScript, Tailwind, Node/Express, PostgreSQL
- **Features:** Click tracking, postback integration, affiliate dashboard, campaign management, JWT auth
- **API:** `/api/click`, `/api/postback`, `/api/affiliate/{id}/clicks|conversions`
- **Status:** Early, basic implementation

---

## Critical Findings

### 1. Wrong Use Case Category
All these projects are **referral program / partner program** platforms — they help you **run your own affiliate program** (recruit affiliates, track their referrals, pay commissions).

**We need the opposite:** Track **our clicks as an affiliate** on external networks (AliExpress, Alibaba, Amazon, CJ, Awin). We are the *publisher*, not the *merchant*.

### 2. AGPL-3.0 Viral License
| Project | License | Risk |
|---------|---------|------|
| AffEasy | AGPL-3.0 | Any SaaS deployment → must open-source our code |
| RefearnApp | AGPL-3.0 | Same |
| RefRef | AGPL-3.0 | Same |
| Cliq | Unknown | Unknown |

**Our project:** Proprietary SaaS (eventually). AGPL-3.0 requires open-sourcing the entire application if deployed as a service. **Dealbreaker.**

### 3. No AliExpress/Alibaba/Amazon Templates
- Zero projects have documented AliExpress Portals postback configuration
- Zero have Alibaba.com B2B `pubid`/`tp1`/`ord_id` templates
- Zero support Amazon Associates (no S2S postback anyway)
- Network templates are for **CJ/Awin/Impact** (merchant-side), not publisher-side

### 4. Maturity Gap
- **AffEasy:** Most mature (3133 commits) but AGPL + wrong use case
- **RefearnApp:** Active but referral-program focused
- **Others:** Alpha/MVP, <1000 commits, "expect bugs"

---

## Could We Fork/Extend One?

### AffEasy (most complete)
- **Pros:** Next.js/TypeScript (our stack), unified network claim, advanced analytics
- **Cons:** AGPL-3.0 viral, no AliExpress template, complex deps (Upstash, PlanetScale, Tinybird, BoxyHQ)
- **Fork effort:** Replace AGPL with MIT? Not allowed — AGPL requires derivative works stay AGPL.

### Build from Scratch (Our Stack)
- **Pros:** MIT license, our exact schema (click_event, conversion_event, commission_record), ModuleContract already exists, SQLite/Postgres portable
- **Cons:** 1-2 weeks dev time
- **Verdict:** **Best path** — we already have 80% of schema and architecture.

---

## License Compatibility Matrix

| Our Use Case | MIT | AGPL-3.0 | Proprietary (Keitaro/Binom) |
|--------------|-----|----------|----------------------------|
| Internal tool | ✅ | ⚠️ (must open-source if SaaS) | ✅ |
| Client-facing SaaS | ✅ | ❌ (viral) | ✅ |
| Modify & distribute | ✅ | ❌ (must stay AGPL) | ❌ |
| **Verdict** | **BEST** | **BLOCKED** | **ACCEPTABLE** |

---

## Conclusion

**Open-source trackers are not viable for our use case because:**
1. Wrong category (referral program vs affiliate network tracking)
2. AGPL-3.0 viral license incompatible with proprietary SaaS
3. No AliExpress/Alibaba postback templates
4. Alpha/beta maturity — not production-ready

**Options remain:**
1. **Keitaro/Binom** (commercial, proprietary, proven templates) — RECOMMENDED for MVP
2. **Build minimal internal tracker** (our stack, MIT, full control) — PARALLEL TRACK