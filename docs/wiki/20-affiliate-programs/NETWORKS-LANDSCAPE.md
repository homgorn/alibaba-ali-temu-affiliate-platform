# Affiliate Network Landscape

> **Summary:** Rank networks by **feed/API availability, not commission rate** — the engine ingests feeds. Tier 1 (verified product APIs): Amazon via the **Creators API**, AliExpress. Tier 2 (publisher APIs exist, docs unscrapable): CJ, Awin, Impact, Partnerize. Tier 3 (manual only): Temu. **Critically: Amazon's PA-API 5 is deprecated and now returns `AccessDenied`** — every pre-2025 Amazon tutorial and SDK is dead on arrival.
>
> Confidence: **6/10** — structural findings verified against primary vendor docs. **Commission rates and cookie windows are NOT verified for any network.**

## ⚠️ Amazon: PA-API 5 is dead

Verified at `webservices.amazon.com/paapi5/documentation/` (2026-10-08):

> "The Amazon Product Advertising API 5.0 (PA-API 5) has been and is being replaced by the Creators API."

Applications still calling it receive:

```json
{
  "__type": "com.amazon.paapi5#AccessDeniedException",
  "Code": "AccessDenied",
  "Message": "Product Advertising API is deprecated. Please migrate to Creators API..."
}
```

**This matters more than any commission rate in this page.** Every pre-2025
Amazon integration tutorial, SDK and GitHub repo targets PA-API 5 and now fails
**at runtime, not build time**. Any prior art found later must be date-checked.

Migration guide (verbatim from the error message):
`https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi`

## Creators API — operations and resources (HARD FACT)

Operations: browse-node lookup · item lookup · keyword search · **variations**.

> "Returns variations for an item i.e. a set of items that are the same product, but differ according to a consistent theme, for example size and color"

Resources: image URLs · item info (Title, Brand, Description) · **parent ASIN** ·
search refinements · multi-marketplace with per-marketplace endpoints.

**INFERENCE (high confidence):** these map onto the engine's primitives exactly —
get-one, search, browse — plus a **variant primitive**, which is directly
relevant to the dedup problem in [PRODUCT-IDENTITY](../40-feeds-data/PRODUCT-IDENTITY.md).
"Parent ASIN" is Amazon's own product-grouping signal; it does not solve
cross-marketplace dedup (an AliExpress listing has no ASIN) but removes the need
to cluster Amazon-side variants ourselves.

⚠️ Endpoints, auth scheme and rate limits **UNVERIFIED** — the docs require an
authenticated Associates account (overview page returned HTTP 404 / permission
error).

## Tiering

| Tier | Networks | Basis |
|---|---|---|
| **1 — verified product API** | Amazon (Creators API), AliExpress | Official documented APIs confirmed |
| **2 — publisher API exists, docs unscrapable** | CJ, Awin, Impact, Partnerize | API endpoints exist; **docs are JS-rendered** |
| **3 — manual/curated only** | Temu | No public API found — see [TEMU](../10-platforms/TEMU.md) |
| **4 — untested** | Admitad, ClickBank, eBay, Walmart, Etsy, Rakuten, regional | Not reached |

### Network reachability this pass

| Network | Publisher page | Result |
|---|---|---|
| Impact.com | `/affiliate-marketing/` | **HTTP 200**, full content |
| Awin | `/affiliates/` | HTTP 404 on path, but publisher/creator segments confirmed in nav |
| CJ | `/affiliate/` | HTTP 404 on path, segments confirmed: Publisher, Influencer, Fintech Publishers, Agency |
| `developers.cj.com` | — | **JS-only SPA** — "You need to enable JavaScript to run this app" |

⚠️ `impact.agency`, `avantaffiliate.com` → **DNS failure**. `partnerize.com`
API docs path returns a 404 page inside a 200 response.

**Tooling consequence:** CJ's and Awin's API references cannot be scraped
without a headless browser. Our research tooling has a real gap here.

## Architecture implication

Tier 1 and Tier 2 networks are **structurally different** — product feeds vs
click/transaction reporting — but both reduce to "fetch, normalise, upsert,
report". A single `ModuleContract` with **capability flags** (e.g.
`supportsProductFeed: boolean`) covers both without special-casing. A contract
that pretends all networks have one shape would be wrong.

## Gaps — not estimated, not guessed

| # | Gap | Blocking? |
|---|---|---|
| G17 | Commission rates / cookie windows / payout minimums — **none verified** | **YES** |
| G18 | Feed availability: Admitad, ClickBank, eBay, Walmart, Etsy | Determines phase-4 order |
| G19 | Approval for a non-US registered entity | Determines whether we can onboard |
| G20 | Amazon Creators API endpoints/auth/limits | Needs Associates account |
| G21 | CJ/Awin API reference contents | Needs headless browser |
| G22 | Impact.com API and feed access | Not reached |
| G23 | Is ShareASale still operating in 2026? | Still unknown |
| G24 | Temu programme terms | Needs headless browser |

**Method note:** `websearch` returned empty for every query this session; all
subagent dispatches failed on daily quota. Findings rest on direct fetches of
known primary URLs.

Full detail: `research/reports/r05-networks-landscape.md`
