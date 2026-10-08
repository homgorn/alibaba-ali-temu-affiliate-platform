# LLM-WIKI — INDEX

**This is the retrieval surface.** Any future session — human or agent — reads
this index first, then the specific page. Pages are self-contained and
front-load a summary so they can be retrieved without full reads.

> **Status:** skeleton. Pages marked `⏳` are pending research round 1.
> Confidence is recorded per page; low confidence is a first-class result.

---

## How to read this wiki

1. Start here → find the page → read its summary block.
2. Every non-obvious claim carries provenance: `[source: research/raw/<track>/<file>.md]`.
3. **Facts and inference are separated.** Statements marked `INFERENCE` are the
   author's reasoning, not established fact. Statements marked `UNVERIFIED` are
   open tasks.
4. If you change a page, update this index in the same commit. A page missing
   from the index does not exist.

---

## 00 · Meta

| Page | Summary | Confidence |
|---|---|---|
| [MISSION.md](00-meta/MISSION.md) | What this project is for, the north star, and what it deliberately refuses to do. | — |
| [GLOSSARY.md](00-meta/GLOSSARY.md) | Domain vocabulary: EPC, feed, deep link, attribution, НПД/ИП, 54-ФЗ, 152-ФЗ. | — |
| [OPERATING-RULES.md](00-meta/OPERATING-RULES.md) | Condensed index of `AGENTS.md` — R1–R4, log and spec protocols. | — |

## 10 · Platforms

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [ALIBABA-B2B.md](10-platforms/ALIBABA-B2B.md) | Alibaba.com Open Platform, whether B2B affiliate exists for outsiders, buying leads, 1688, 淘宝联盟. | ⏳ R2 |
| ⏳ [TEMU.md](10-platforms/TEMU.md) | Temu creator/affiliate programs, API reality, grey mechanisms and their ToS status. | ⏳ R3 |

## 20 · Affiliate programs

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [ALIEXPRESS-AFFILIATE.md](20-affiliate-programs/ALIEXPRESS-AFFILIATE.md) | The core integration: eligibility, endpoints, limits, commission terms, test env. | ⏳ R1 |
| ⏳ [NETWORKS-LANDSCAPE.md](20-affiliate-programs/NETWORKS-LANDSCAPE.md) | All other joinable networks (goods + services), with feed/API availability as the ranking key. | ⏳ R5 |

## 30 · API reference

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [ALIEXPRESS-API.md](30-api-reference/ALIEXPRESS-API.md) | Endpoint-by-endpoint reference: paths, methods, params, responses, auth/signature flow. | ⏳ R1 |
| ⏳ [AUTH-AND-LIMITS.md](30-api-reference/AUTH-AND-LIMITS.md) | App-key auth, signature algorithm, rate limits, quota exhaustion behaviour, error catalogue. | ⏳ R1 |
| ⏳ [LINK-BUILDING.md](30-api-reference/LINK-BUILDING.md) | How affiliate/deep tracking links are constructed, per platform. | ⏳ R1, R3 |

## 40 · Feeds & data

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [PRODUCT-IDENTITY.md](40-feeds-data/PRODUCT-IDENTITY.md) | The ID systems (productId/itemId/skuId/…) and how to detect "same product" across listings. The core data problem. | ⏳ R4 |
| ⏳ [DEDUP.md](40-feeds-data/DEDUP.md) | Fingerprinting techniques: image hashing, title normalisation, GTIN matching, price signals. | ⏳ R4 |
| ⏳ [INGESTION-ARCHITECTURE.md](40-feeds-data/INGESTION-ARCHITECTURE.md) | Incremental sync, watermarks, idempotent upserts, backoff, dead-letter. | ⏳ R4 |
| ⏳ [STORAGE-SIZING.md](40-feeds-data/STORAGE-SIZING.md) | Rows/day, GB/year, index cost, and the Postgres-vs-SQLite-vs-column-store decision with real numbers. | ⏳ R4 |
| ⏳ [SEARCH-AND-FACETING.md](40-feeds-data/SEARCH-AND-FACETING.md) | Postgres FTS vs Meilisearch vs Typesense for a multi-language affiliate catalog. | ⏳ R4 |
| ⏳ [PRICE-HISTORY.md](40-feeds-data/PRICE-HISTORY.md) | Snapshot schema, retention, downsampling, and detecting fake "discounts". | ⏳ R4, R7 |

## 50 · Strategy & traffic

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [CHANNEL-REALITY.md](50-strategy-traffic/CHANNEL-REALITY.md) | Which channels work in 2026 for RU/CIS physical-goods affiliate; time-to-first-commission per channel. | ⏳ R6 |
| ⏳ [UNIT-ECONOMICS.md](50-strategy-traffic/UNIT-ECONOMICS.md) | CPC/EPC reality with explicit arithmetic: clicks needed per revenue target. | ⏳ R6 |
| ⏳ [TRAFFIC-IDEAS.md](50-strategy-traffic/TRAFFIC-IDEAS.md) | The 12–18 synthesised traffic ideas, ranked by value-to-effort. | ⏳ R6 |
| ⏳ [ATTRIBUTION-AND-FRAUD.md](50-strategy-traffic/ATTRIBUTION-AND-FRAUD.md) | What destroys EPC in 2026, and the legitimate countermeasures. | ⏳ R6 |

## 60 · Product synthesis

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [CONCEPT-CATALOGUE.md](60-product-synthesis/CONCEPT-CATALOGUE.md) | All product concepts with problem, data need, incumbent wedge, effort. | ⏳ R7 |
| ⏳ [LANDED-COST.md](60-product-synthesis/LANDED-COST.md) | True landed cost: item + shipping + customs/VAT + delivery time. The question cross-border buyers actually ask. | ⏳ R7 |
| ⏳ [RISK-WARNING.md](60-product-synthesis/RISK-WARNING.md) | Fake-discount detection, counterfeit/gray-goods risk, safety-critical categories. | ⏳ R7 |
| ⏳ [TRUST-MODEL.md](60-product-synthesis/TRUST-MODEL.md) | How to monetise without the user feeling betrayed; disclosure design. | ⏳ R7 |

## 70 · Architecture

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [SYSTEM-OVERVIEW.md](70-architecture/SYSTEM-OVERVIEW.md) | Engine + modules topology, plugin contract, data flow. | — |
| ⏳ [MODULE-CONTRACT.md](70-architecture/MODULE-CONTRACT.md) | The interface every network integration must implement. | — |
| ⏳ [STACK-DECISION.md](70-architecture/STACK-DECISION.md) | Language, ORM, queue, search, deployment — with the reasoning and the alternatives. | — |
| [ADR/](adr/) | Architecture Decision Records, one per decision. | — |

## 80 · Legal & compliance

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [TAX-RU.md](80-legal-compliance/TAX-RU.md) | НПД vs ИП, thresholds, reporting, foreign-currency payout mechanics. | ⏳ R8 |
| ⏳ [ADVERTISING-LAW-RU.md](80-legal-compliance/ADVERTISING-LAW-RU.md) | 54-ФЗ advertising marking, disclosure on sponsored content, penalties. | ⏳ R8 |
| ⏳ [PERSONAL-DATA-RU.md](80-legal-compliance/PERSONAL-DATA-RU.md) | 152-ФЗ obligations and database localisation. | ⏳ R8 |
| ⏳ [TRADEMARK-USE.md](80-legal-compliance/TRADEMARK-USE.md) | When logos/names of platforms may be used in an affiliate project. | ⏳ R8 |
| ⏳ [API-TOS-CONSTRAINTS.md](80-legal-compliance/API-TOS-CONSTRAINTS.md) | Retention limits, redistribution bans, caching rules — hard constraints on the schema. | ⏳ R8 |
| ⏳ [RISK-REGISTER.md](80-legal-compliance/RISK-REGISTER.md) | Full register with severity and launch-blocking status. | ⏳ R8 |

## 90 · Research log

| Page | Summary | Confidence |
|---|---|---|
| ⏳ [R1-ALIEXPRESS-API.md](90-research-log/R1-ALIEXPRESS-API.md) | Track R1 findings + gaps. | ⏳ |
| ⏳ [R2-ALIBABA-B2B.md](90-research-log/R2-ALIBABA-B2B.md) | Track R2 findings + gaps. | ⏳ |
| ⏳ [R3-TEMU.md](90-research-log/R3-TEMU.md) | Track R3 findings + gaps. | ⏳ |
| ⏳ [R4-FEEDS-DATA-ENG.md](90-research-log/R4-FEEDS-DATA-ENG.md) | Track R4 findings + gaps. | ⏳ |
| ⏳ [R5-NETWORKS.md](90-research-log/R5-NETWORKS.md) | Track R5 findings + gaps. | ⏳ |
| ⏳ [R6-TRAFFIC.md](90-research-log/R6-TRAFFIC.md) | Track R6 findings + gaps. | ⏳ |
| ⏳ [R7-PRODUCT-SYNTHESIS.md](90-research-log/R7-PRODUCT-SYNTHESIS.md) | Track R7 findings + gaps. | ⏳ |
| ⏳ [R8-LEGAL.md](90-research-log/R8-LEGAL.md) | Track R8 findings + gaps. | ⏳ |

---

## Non-wiki references

| Artefact | Purpose |
|---|---|
| [`feature_list.json`](../feature_list.json) | The work ledger. Every verifiable feature, `passes: false` until a verifier proves it. |
| [`ROADMAP.md`](../roadmap/ROADMAP.md) | Phased plan, ordered by what unblocks the most. |
| [`../research/reports/`](../research/reports/) | Full per-track research reports. |
| [`../research/raw/`](../research/raw/) | Verbatim source captures — provenance for every cited claim. |
