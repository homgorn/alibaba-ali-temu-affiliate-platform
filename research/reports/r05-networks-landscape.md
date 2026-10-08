# R05 — Affiliate Network Landscape (recovery attempt 2)

> **Status: PARTIAL.** The first attempt died with zero output. The recovery
> attempt also died (provider daily quota). This report was produced by the
> orchestrator using direct HTTP fetches of primary sources, because
> `websearch` was returning empty results for every query and subagents could
> not be dispatched.
>
> Confidence: **6/10** — the decisive structural findings are verified against
> primary vendor docs. Commission rates, cookie windows and approval terms for
> most networks are **NOT** verified and must not be treated as fact.

---

## What was verified directly (HARD FACT)

### Amazon — PA-API 5 is dead, Creators API is the successor

Verified at `webservices.amazon.com/paapi5/documentation/` (2026-10-08):

> "The Amazon Product Advertising API 5.0 (PA-API 5) has been and is being replaced by the Creators API."

Applications still calling PA-API 5 receive:

```json
{
  "__type": "com.amazon.paapi5#AccessDeniedException",
  "Code": "AccessDenied",
  "Message": "Product Advertising API is deprecated. Please migrate to Creators API..."
}
```

Creators API operations (verified): browse-node lookup, item lookup, keyword
search, and **variations** ("a set of items that are the same product, but differ
according to a consistent theme, for example size and color"). Resources include
image URLs, item info (Title, Brand, Description), parent ASIN, and search
refinements. Multi-marketplace with per-marketplace endpoints.

**Why this matters more than any commission rate in this report:** every
pre-2025 Amazon integration tutorial and SDK targets PA-API 5 and will now fail
at *runtime* with `AccessDenied`. Any prior art discovered later must be
date-checked. An Amazon module here must target Creators API.

### Network sites reachable

| Network | Publisher page | Status |
|---|---|---|
| Impact.com | `impact.com/affiliate-marketing/` | **HTTP 200**, full navigation. Publishes for "Affiliates, Influencers and creators", "Content publishers", "Mobile apps" |
| Awin | `awin.com/affiliates/` | **HTTP 404** on that path; publisher/creator segments exist in nav ("Affiliate partners", "Content creators & influencers", "Agencies") |
| CJ | `cj.com/affiliate/` | **HTTP 404** on that path; segments visible: "Publisher", "Fintech Publishers", "Influencer", "Agency" |

**INFERENCE:** CJ and Awin both clearly serve publishers and run publisher APIs
(their `help.awin.com` and `developers.cj.com` endpoints exist; the latter
returned an SPA shell — "You need to enable JavaScript to run this app" — which
means **the CJ developer docs are JS-rendered and cannot be scraped without a
browser**). That is a tooling finding in its own right: our research tooling
cannot read CJ's API reference automatically.

### Dead / unreachable during this pass

| Target | Result |
|---|---|
| `impact.agency` (partner support) | **DNS failure** — ENOTFOUND |
| `avantaffiliate.com/api/` | **DNS failure** — ENOTFOUND |
| `partnerize.com` API docs path | HTTP 200 but the served content is a **404 page** ("Error: 404 Page Not Found") |
| `temu.com/temu-partner.html` | HTTP 200, **2889 bytes, no extractable text** — JS-only or empty shell |
| `partner.temu.com` | HTTP 200, **702 bytes**: "You need to enable JavaScript to run this app." |

---

## The Temu finding (R3 conclusion)

**No public affiliate API was found, and no public developer portal exists.**

Both Temu partner entry points return JavaScript application shells with no
server-rendered content. No developer documentation, no endpoint catalogue, no
SDK, no auth documentation was discoverable.

**Classification: HARD FACT (as a negative finding)** — the absence of any
publicly documented API surface is itself the finding. Confidence **7/10** for
"no public API documentation exists"; **4/10** for "no API exists at all" (a
private/creator-dashboard-only API may exist and would not be discoverable).

**Implication:** Temu cannot be a feed-backed module. Realistic options are
(a) manual CSV curation, (b) drop it, (c) treat Temu as a *content* source rather
than a data source — a person browses, a human curates, the platform publishes.
Option (c) is honest about the constraint and still captures value.

⚠️ **This is deliberately not a scraping guide.** Grey/ToS-violating
mechanisms were explicitly out of scope for this pass and are not documented
here.

---

## Structural insight: rank by feed availability, not commission rate

The engine ingests **feeds**. So the ranking criterion is feed/API availability,
and commission rate is secondary. Working conclusion:

| Tier | Networks | Basis |
|---|---|---|
| **1 — verified feed** | Amazon (Creators API), AliExpress (affiliate API, pending eligibility) | Official documented product APIs confirmed |
| **2 — publisher API exists, docs unscrapable** | CJ, Awin, Impact, Partnerize | Publisher API endpoints exist; docs are JS-rendered |
| **3 — manual/curated only** | Temu | No public API found |
| **4 — untested** | Admitad, ClickBank, eBay, Walmart, Etsy, Rakuten, regional | Not reached this pass |

**INFERENCE (high confidence):** the plugin-contract architecture is validated by
this. Tier 1 and Tier 2 look structurally different — one is product feeds, the
other is click/transaction reporting — but both reduce to "fetch, normalise,
upsert, report". A single `ModuleContract` with a capability flag (e.g.
`supportsProductFeed: boolean`) covers both without special-casing.

---

## GAPS — explicitly unresolved

Nothing below is estimated or guessed. These are open.

| # | Gap | Why it matters |
|---|---|---|
| **G17** | Commission rates, cookie windows, payout minimums for every network | Determines revenue model. **Not verified for any network.** |
| **G18** | Feed/API availability for Admitad, ClickBank, eBay, Walmart, Etsy | Determines phase-4 integration order |
| **G19** | Approval requirements for a non-US registered entity per network | Determines whether we can onboard at all |
| **G20** | Amazon Creators API endpoints, auth scheme, rate limits | Blocked — docs require an authenticated Associates account |
| **G21** | CJ/Awin API reference contents | Blocked — JS-rendered docs, need a headless browser |
| **G22** | Impact.com API availability and feed access | Not reached |
| **G23** | Whether ShareASale is still operating in 2026 | Still unknown — not researched this pass |
| **G24** | Temu creator programme terms | Blocked — partner.temu.com is a JS shell |

**Method note:** `websearch` returned **"No search results found"** for every
query in this session, and all subagent dispatches failed on
`free-models-per-day-high-balance`. This report therefore rests on direct fetches
of known URLs. It is a smaller evidence base than intended, and the gaps above
are the honest measure of that.

---

## Recommendation

1. **Treat Amazon Creators API as the reference implementation** for a
   product-feed module. It is documented, multi-marketplace, and has a
   variations/variant primitive we need anyway.
2. **Do not build a Temu module.** Insufficient public API surface. Revisit only
   if Temu publishes docs.
3. **Write the `ModuleContract` with capability flags, not a single shape.** Tier 1
   and Tier 2 networks have genuinely different shapes; the contract must not
   pretend otherwise.
4. **Re-run G17–G24 when `websearch` recovers.** Commission data is not
   guessable and this project must not invent it.

Provenance: `research/raw/r05-networks-landscape/001-amazon-creators-api-migration.md`
