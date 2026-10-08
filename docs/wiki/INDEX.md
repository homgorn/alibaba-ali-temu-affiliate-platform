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
| [ALIBABA-B2B.md](10-platforms/ALIBABA-B2B.md) | **B2B affiliate DOES exist** (ads.alibaba.com, up to 15%) — but it refuses Russian traffic and blocks all MMP attribution. High-ticket, late-paying. Deferred per D-009. | **9/10** |
| [TEMU.md](10-platforms/TEMU.md) | **No public API exists** — both partner URLs are JS shells. Build nothing; use as curated content source. Grey scraping rejected on principle. | **7/10** |

## 20 · Affiliate programs

| Page | Summary | Confidence |
|---|---|---|
| [ALIEXPRESS-AFFILIATE.md](20-affiliate-programs/ALIEXPRESS-AFFILIATE.md) | API is real but gated: Portals account + Open Platform app of type "Affiliate API" + business licence. **No sandbox.** 3-day cookie. ~5k req/day. 8 open gaps (G1–G8). | **7/10** |
| [NETWORKS-LANDSCAPE.md](20-affiliate-programs/NETWORKS-LANDSCAPE.md) | **Rank by feed availability, not commission.** Amazon's PA-API 5 is DEPRECATED (returns `AccessDenied`) — use Creators API. Tiering + capability-flag contract. | **6/10** |

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
| [LLM-DISCOVERABILITY.md](50-strategy-traffic/LLM-DISCOVERABILITY.md) | **LLM crawlers must be assumed not to run JS.** HTML-first, `.md` twins, llms.txt v2, `Link:` headers, AI-bot robots policy. Basis for D-010. **The one traffic thesis resting on verified evidence.** | **9/10** |
| [UNIT-ECONOMICS.md](50-strategy-traffic/UNIT-ECONOMICS.md) | **BLOCKED — framework only, no figures invented.** The `TAC = CPC/CR < EPC` test decides paid vs organic. 3-day cookie is the binding constraint. | **3/10 (framework 9/10)** |
| ⏳ [CHANNEL-REALITY.md](50-strategy-traffic/CHANNEL-REALITY.md) | Which channels work in 2026; time-to-first-commission per channel. | ⏳ blocked by G25 |
| ⏳ [TRAFFIC-IDEAS.md](50-strategy-traffic/TRAFFIC-IDEAS.md) | 12–18 synthesised traffic ideas. **Deferred, not abandoned** — writing them without EPC data would be generic advice. | ⏳ deferred |
| ⏳ [ATTRIBUTION-AND-FRAUD.md](50-strategy-traffic/ATTRIBUTION-AND-FRAUD.md) | What destroys EPC in 2026, and legitimate countermeasures. | ⏳ deferred |

## 60 · Product synthesis

| Page | Summary | Confidence |
|---|---|---|
| [COMPETITIVE-LANDSCAPE.md](60-product-synthesis/COMPETITIVE-LANDSCAPE.md) | B2B price tools are crowded but all serve retailers; consumer trackers are Amazon-only. **Empty quadrant: consumer-facing cross-border intelligence.** Five ranked gaps. | **8/10** |
| ⏳ [CONCEPT-CATALOGUE.md](60-product-synthesis/CONCEPT-CATALOGUE.md) | All product concepts with problem, data need, incumbent wedge, effort. | ⏳ R7 |
| ⏳ [LANDED-COST.md](60-product-synthesis/LANDED-COST.md) | True landed cost: item + shipping + customs/VAT + delivery time. The highest-value gap (see COMPETITIVE-LANDSCAPE Space 1). | ⏳ R7 |
| ⏳ [RISK-WARNING.md](60-product-synthesis/RISK-WARNING.md) | Fake-discount detection, counterfeit risk. **Note: safety-critical categories are now excluded outright (D-012).** | ⏳ R7 |
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
| ⏳ [TAX-RU.md](80-legal-compliance/TAX-RU.md) | **Operator is ИП, not НПД.** НПД vs ИП thresholds, reporting. ⚠️ **Payout mechanics from a foreign network to a Russian ИП is the critical unresolved question (R-002).** | **6/10** |
| ⏳ [ADVERTISING-LAW-RU.md](80-legal-compliance/ADVERTISING-LAW-RU.md) | 54-ФЗ advertising marking, disclosure on sponsored content, penalties. | ⏳ R8 |
| ⏳ [PERSONAL-DATA-RU.md](80-legal-compliance/PERSONAL-DATA-RU.md) | 152-ФЗ obligations and database localisation. | ⏳ R8 |
| ⏳ [TRADEMARK-USE.md](80-legal-compliance/TRADEMARK-USE.md) | When logos/names of platforms may be used in an affiliate project. | ⏳ R8 |
| ⏳ [API-TOS-CONSTRAINTS.md](80-legal-compliance/API-TOS-CONSTRAINTS.md) | Retention limits, redistribution bans, caching rules — hard constraints on the schema. | ⏳ R8 |
| ⏳ [RISK-REGISTER.md](80-legal-compliance/RISK-REGISTER.md) | Full register with severity and launch-blocking status. | ⏳ R8 |

## 90 · Research log

| Page | Summary | Confidence |
|---|---|---|
| [RESEARCH-ROUNDS.md](90-research-log/RESEARCH-ROUNDS.md) | Round 1 (all 8 agents died) and round 2 (quota exhausted, partial recovery), with root causes. | — |
| ⏳ R1–R8 individual pages | Folded into the topic pages above to avoid duplicating a source of truth. | — |

---

## Non-wiki references

| Artefact | Purpose |
|---|---|
| [`feature_list.json`](../feature_list.json) | The work ledger. 27 features, every one `passes: false` until a verifier proves it. |
| [`ROADMAP.md`](../roadmap/ROADMAP.md) | Phased plan, ordered by what unblocks the most. 8-level test ladder. |
| [`../AGENTS.md`](../AGENTS.md) | Operating rules R1–R4. Read this before touching anything. |
| [`../research/reports/`](../research/reports/) | Full per-track research reports. |
| [`../research/raw/`](../research/raw/) | Verbatim source captures — provenance for every cited claim. |
| [`scripts/agents-doctor.mjs`](../scripts/agents-doctor.mjs) | Agent harness pre-flight. Run before any fan-out. |
| [`scripts/dispatch.mjs`](../scripts/dispatch.mjs) | Resilient dispatcher. `--check <track>` inspects what survived a failed run. |

---

## ⚠️ Active blockers

| ID | Blocker | Who |
|---|---|---|
| **G25** | No EPC/CPC data obtainable — **blocks all traffic spend** (D-020) | needs `websearch` recovery |
| **G17** | Commission rates unverified for **every** network | needs `websearch` recovery |
| **G1–G4** | AliExpress endpoint list, signing algorithm, rate limits, **ИП eligibility** | operator + API access |
| **G20–G21, G24** | Amazon Creators API details, CJ/Awin docs, Temu terms — all **JS-rendered**, need a headless browser | tooling gap |
| **G16** | RU/CIS competitors — positioning unvalidated | needs `websearch` |
| **M1** | Analytics/tracking unspecified — measurement impossible without it | operator decision |
| **B1** | `gh` not authenticated — cannot push | operator |
| **G27** | Account daily quota exhausted — agent dispatch blocked | resets with quota |
