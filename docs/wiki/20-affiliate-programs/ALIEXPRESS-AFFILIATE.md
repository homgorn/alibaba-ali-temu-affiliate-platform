# AliExpress Affiliate API — Access Reality

> **Summary:** The API is real and documented, but access is gated: you need a **Portals account plus an Open Platform developer app of type "Affiliate API", and a business licence is required**. There is **no sandbox**. The practical route for the operator is: register a Portals account with real traffic, get approved manually, then create the developer app. Until keys exist, nothing that needs live credentials can be built — but the ingestion engine can be built against a manual CSV feed, which is a deliberate design choice, not a compromise.
>
> Confidence: **7/10** — API surface is well documented; *eligibility specifics* rest on secondary sources and need first-party confirmation.

## What exists (HARD FACT)

Platform: https://openservice.aliexpress.com/doc/api.htm

Documented API families include: **AE-Affiliate**, AE-Logistics, AE-Product Management, AE-Order & Transaction, AE-Settlement.

Confirmed affiliate endpoints:

| Endpoint | Purpose | Source |
|---|---|---|
| `aliexpress.affiliate.hotproduct.query` | Query hot products, paginated | open.alitrip.com apiId=45794 |
| `aliexpress.affiliate.hotproduct.download` | Bulk hot-product download | open.alitrip.com apiId=48598 |
| `aliexpress.affiliate.link.generate` | Generate tracking deep links | seen in SDK issues |

⚠️ The endpoint **names** above are documented; the **complete current list is not yet captured**. Round 1 was interrupted before the full catalogue could be verified. Treat this table as a starting point, not a specification. See [GAPS](#gaps).

## Auth (HARD FACT, with a conflict to resolve)

OAuth 2.0. Token endpoints: `/auth/token/create`, `/auth/token/refresh`, `/auth/token/security/create`, `/auth/token/security/refresh`.

Formal environment: `https://oauth.aliexpress.com/authorize` and `https://oauth.aliexpress.com/token`.

> "Is a sandbox test mandatory for user authorization? The AliExpress development platform does not support a sandbox test."

**No sandbox.** This is a major engineering constraint: there is no way to validate an integration end-to-end without touching the production API. Every request counts against quota and mistakes can pollute real attribution data. Mitigations are specified in the ingestion spec — dry-run mode, replay from recorded fixtures, and a request budget.

### Regional API hosts

Documented for the affiliate API (source: developer.alibaba.com articleId=118934, dated 2022 — **STALE, verify**):

| Region | Host |
|---|---|
| US | `api.taobao.com` |
| EU | `de-api.aliexpress.com` |
| Russia | `ru-api.aliexpress.com` |

### Signing — unresolved conflict (⚠️ important)

Two different algorithms are reported:

| Source | Algorithm |
|---|---|
| developer.alibaba.com (2022, **stale**) | MD5 + HMAC |
| wuTims/shopping-assistant (GitHub) | HMAC-SHA256 |
| Third-party SDKs (2025–2026) | TypeScript/.NET/Python/PHP SDKs exist |

**INFERENCE:** the 2022 doc is stale; the community SDKs from 2025–2026 almost certainly reflect the current algorithm. **Do not implement from either until confirmed.** A wrong signature algorithm produces `IncompleteSignature` errors — a known failure mode reported on Stack Overflow for `affiliate.link.generate`.

⚠️ **RU host note:** `ru-api.aliexpress.com` exists as a *regional API host*. This is **not** the same thing as the affiliate programme accepting Russian traffic — and given Alibaba B2B's explicit Russia exclusion, do not assume B2B and AliExpress share a geo policy. Verify per-programme.

## Access requirements (CONFIDENCE: MEDIUM — from secondary sources)

From wasabitheme.com (2025-02-04), consistent with the docs' own "How to invoke affiliate API" page:

1. Create an AliExpress account → **Portals** → apply, providing **traffic information** → manual review.
2. Create an **Open Platform developer account** → create an app of type **"Affiliate API"** → **business licence required**.
3. Review reportedly ~2 business days.
4. Activate the developer account at `console.aliexpress.com`.

### Permission scoping — a real trap (HARD FACT, from a practitioner's report)

> "Our app has Dropship API access only. Affiliate APIs (`aliexpress.affiliate.*`) return `InsufficientPermission`."

**INFERENCE:** Dropship and Affiliate are **separate permission scopes**. An app approved for one gets `InsufficientPermission` on the other. This must be an explicit verification step in the onboarding runbook — a green "API working" test against a Dropship endpoint proves nothing about Affiliate access.

Also reported: Botize's Influencer Program reportedly blocks Affiliate API access entirely — i.e. an influencer account is not a substitute for a Portals account.

## Commission (CONFIDENCE: MEDIUM — third-party programme directories)

| Property | Value | Source type |
|---|---|---|
| Basic rate | 0–9% | portals.aliexpress.com (official, marketing) |
| Hot Products | up to 90% | portals.aliexpress.com (official, marketing) |
| Cookie window | **3 days** | 3 independent programme directories |
| Minimum payout | $16 | 2 sources |
| Payout delay | Net 60 | 1 source — LOW confidence |
| Bank fee | $15 | 1 source — LOW confidence |

Official page claims: "120M+ affiliate products", "up to 9% basic commission rate (up to 90% for Hot Products)", "200+ supported countries".

**INFERENCE:** a **3-day cookie is extremely short** for physical goods with long delivery times. A buyer who clicks on Monday and buys the following Monday is lost. This single fact should shape all traffic strategy: content must convert within the click, and remarketing is nearly impossible. Compare with Awin US (10 days) and FlexOffers (10 days) — AliExpress is materially worse for anything but impulse or high-intent clicks.

**Not all products have affiliate commission.** Promotable products are searchable at `portals.aliexpress.com/adcenter/affiliateProductSearch.htm`. This means the feed must be filtered on commission eligibility, not merely on price — a product we store but cannot earn on is dead weight.

## Quota (CONFIDENCE: LOW-MEDIUM)

- **5,000 requests/day** reported for the affiliate API (2025, single secondary source).

**INFERENCE:** 5,000 req/day is a *severe* budget for a 120M-product catalogue — roughly 0.00004% of the catalogue per day. This makes the ingestion strategy load-bearing: incremental sync by category/keyword rather than full-crawl, aggressive caching, and prioritising only commission-eligible, high-value SKUs. A naive "sync everything" design is arithmetically impossible. **Sizing math is the top gap for round 2.**

## GAPS — what round 1 did NOT establish

These are open tasks, recorded rather than guessed:

| # | Gap | Why it matters |
|---|---|---|
| G1 | Complete current endpoint list with params/responses | Cannot write the module contract |
| G2 | Confirmed signing algorithm (MD5/HMAC vs HMAC-SHA256) | Wrong algorithm = total failure |
| G3 | Verified daily/rate limits per API family | Determines the whole ingestion design |
| G4 | Whether a Russian ИП is eligible for an Affiliate API app | Determines whether this project is viable at all |
| G5 | Whether `ru-api.aliexpress.com` implies RU traffic is accepted | Geo policy affects content strategy |
| G6 | Exact commission rates by category | Needed for offer ranking |
| G7 | Bulk catalog feed: format, cadence, access | Cheaper than the API if it exists |
| G8 | Deprecation status — one key doc is marked 已废弃 (deprecated) | Risk the affiliate API is being retired |

⚠️ **G8 deserves attention:** developer.alibaba.com articleId=118193 carries a 已废弃 (deprecated) marker (dated 2021). That may apply only to that page rather than the programme, but it is a genuine signal that parts of this documentation set are stale and the programme may be evolving. Verify before committing architecture.

## Recommended next action (unblocks everything)

1. Register a Portals account with genuine traffic description → wait for manual approval.
2. Create the Open Platform app **specifically of type "Affiliate API"** — not Dropship.
3. Confirm ИП eligibility and geo policy in the same message.
4. Meanwhile: build the engine against a **manual CSV feed** so that progress is never blocked by an approval queue we do not control.

Provenance: `research/raw/r01-aliexpress-affiliate-api/001-official-api-docs.md`
