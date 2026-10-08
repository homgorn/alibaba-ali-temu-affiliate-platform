# SPEC-003 — Data Schema

| Field | Value |
|---|---|
| **ID** | SPEC-003 |
| **Status** | **Approved** |
| **Author** | orchestrating agent |
| **Date** | 2026-10-08 |
| **Reviewers** | operator (pending) · architect agent (pending) |
| **Depends on** | SPEC-001 (ingestion engine) |
| **Evidence** | [`docs/wiki/30-api-reference/ALIEXPRESS-API.md`](../wiki/30-api-reference/ALIEXPRESS-API.md) · [`research/raw/r04-feeds-data-eng/`](../../research/raw/r04-feeds-data-eng/) |

---

## 1. Context

We need a schema that holds a multi-network product catalogue with historical
pricing, and that works identically on SQLite (development, this machine has no
Docker) and Postgres (production).

Three verified facts from the API research shape this design.

**First, `ship_to_country` returns per-destination pricing under each country's
tax policy.** That means a product's price is not one number — it is a function
of `(product, destination_country)`. A schema with a single `price` column
cannot represent the platform's actual semantics, and would silently lose the
data that makes landed cost our highest-value product.

**Second, `product_video_url`, `product_small_image_urls`, `product_id`,
`shop_id` and `commission_rate` all arrive per record.** No joins needed to
render a basic product page.

**Third, the daily API quota is not publicly documented** (gap G3, unverified
5,000/day). This makes row-count discipline a hard requirement, not an
optimisation: a schema that cannot be fed within quota cannot be filled.

A fourth constraint is non-technical but binding: affiliate API terms may cap
retention, and that is still unconfirmed (gap M6). **Retention is therefore a
column-level property of the schema itself**, so that tightening it later is a
config change rather than a rewrite (decision D-013).

---

## 2. Sizing arithmetic

Shown rather than asserted, because the choice of engine depends on it.

### Assumptions (stated so they can be challenged)

| # | Assumption | Basis |
|---|---|---|
| A1 | Start with **50,000** tracked products | A curated subset, not the 120M-product catalogue. Sized to what a ~5,000 req/day budget can plausibly cover. |
| A2 | **4** price observations per product per day while actively tracked | Near-real-time for hot products, sampled for the rest |
| A3 | **2 KB** average catalogue row | title + images + category path + metadata |
| A4 | **100 bytes** per price observation row | narrow numeric row |
| A5 | 7 days of hourly retention, then daily rollup | standard E-commerce analytics retention |

### Catalogue

```
50,000 products × 2 KB            = 100 MB
indices (~30% overhead)           =  30 MB
                                  --------
total catalogue                   = 130 MB
```

### Price history

```
Hourly, 7 days:
  50,000 × 4/day × 7 days        = 1,400,000 rows
  × 100 B                        =   140 MB

Daily rollup, 365 days:
  50,000 × 365                   = 18,250,000 rows
  × 100 B                        = 1,825 MB   ≈ 1.8 GB
                                  ---------
total price history              ≈ 1.94 GB

with indices (~40% on a narrow numeric table)
                                  ≈ 2.7 GB
```

### Total at start scale

| Component | Size |
|---|---|
| Catalogue | 0.13 GB |
| Price history | 2.7 GB |
| **Total** | **≈ 2.9 GB** |

### Scaling to 500,000 products

| Component | Size |
|---|---|
| Catalogue | 1.3 GB |
| Price history | 27 GB |
| **Total** | **≈ 28 GB** |

### ⚠️ What this arithmetic decides

**28 GB does not fit SQLite comfortably** for a multi-year retention window, and
SQLite has no concurrent-write story for a continuous ingestion worker. But it
*does* fit comfortably at start scale, which is exactly why the split is:

- **Dev (SQLite):** real schema, real migrations, fixtures at 5,000 products
  (1% of start scale). Every query path is exercised.
- **Prod (Postgres):** the same schema, the same migration files.

**Verdict: the arithmetic supports the SQLite-dev / Postgres-prod split (D-011)
and rules out pure-SQLite at scale.** Recorded as ADR-003.

⚠️ These are **assumptions**, not measurements. A1 and A2 are the two that matter
most and both are unverified — G3 (quota) constrains A1, and A2 is a design
choice. **If A2 is wrong by an order of magnitude, price history dominates and
downsampling becomes mandatory rather than optional.** The retention policy in
§3.5 is designed to absorb exactly that.

---

## 3. Functional Requirements

### 3.1 Portability

- **FR-1** The schema MUST apply cleanly to both SQLite and Postgres from the
  same migration files, without per-engine forks.
- **FR-2** The schema MUST NOT use any engine-specific type or feature without a
  documented portability shim. Where a feature cannot be portable, it MUST be
  isolated to a clearly marked optional section.
- **FR-3** Money MUST be stored as an **integer in minor units** (cents) plus an
  ISO-4217 currency code. Floating point MUST NOT be used for money. This is
  non-negotiable: 0.1 + 0.2 ≠ 0.3 in IEEE 754, and this project's core product
  is a price computation.

### 3.2 Product identity

- **FR-4** Every product MUST be uniquely identified by
  `(network, external_product_id)`. This is the ingest key and MUST be stable
  across re-ingestion.
- **FR-5** The schema MUST support cross-listing identity — the same physical
  product sold by different sellers on different networks — via a separate
  identity table with a **confidence score**, never by merging rows. Merging
  destroys the per-network attribution we need for commission reconciliation.
- **FR-6** Cross-listing matches MUST be **candidates**, not assertions. A match
  MUST carry the signals that produced it and a confidence value.

### 3.3 Pricing — the core of the product

- **FR-7** Price observations MUST be keyed by
  `(product_id, destination_country, observed_at)`.
- **FR-8** A price MUST ALWAYS carry its currency code. Prices in different
  currencies MUST NOT be compared or averaged directly.
- **FR-9** **Unknown is distinct from zero.** Where a price component (shipping,
  delivery estimate, duty) is unknown, the schema MUST represent that as NULL
  and MUST provide a way to distinguish "unknown" from "not applicable". A total
  computed from incomplete parts MUST be marked incomplete rather than presented
  as final. This is the honesty requirement from the mission, enforced in the
  data layer rather than the UI.
- **FR-10** The schema MUST store `delivery_bucket_days` (integer) separately
  from price. Delivery time is a verified API parameter (`delivery_days`) and is
  a primary input to landed-cost value.
- **FR-11** Historical price series MUST be queryable per product per
  destination without scanning the full history table.

### 3.4 Commission and monetisation

- **FR-12** `commission_rate` MUST be stored per product per destination, since
  rates can differ by market.
- **FR-13** A product with NULL commission MUST be flagged `monetisable = false`
  and MUST be excluded from monetised surfaces. A product we cannot earn on is
  dead weight (SPEC-001 FR-19).
- **FR-14** Affiliate/promotion links MUST be stored with the timestamp at which
  they were observed. **Links are volatile** (SPEC-001 EC-10) — a stored link is
  a cached claim, not a guarantee, and must be revalidatable.

### 3.5 Retention — first-class

- **FR-15** Every time-varying table MUST declare a retention class. The
  retention policy MUST be **configuration**, not hardcoded in a migration.
- **FR-16** A scheduled job MUST delete data beyond its class's maximum age.
- **FR-17** Deletion MUST be **batched and resumable**. A retention job over a
  large table MUST NOT hold a long transaction.
- **FR-18** The raw/high-resolution price table MUST downsample to a daily
  rollup before deletion. Deleting raw data MUST NOT lose the ability to answer
  "what was the price a year ago" — that is the product.

### 3.6 Provenance and audit

- **FR-19** Every stored value that came from a feed MUST be traceable to
  `(source, source_run_id)` (SPEC-001 FR-18).
- **FR-20** The schema MUST support recording **why** a row was excluded — in
  particular, safety-critical category exclusions (D-012) — as a first-class
  audit record, not just a log line.

### 3.7 Search

- **FR-21** Free-text search MUST work on both engines using only portable
  primitives. Full-text search index creation MAY be engine-specific but MUST
  live in a separate, optional migration that does not block a working install.

### 3.8 Multi-network

- **FR-22** Every table holding network-sourced data MUST carry `network`. No
  table may be implicitly single-network — the whole point is that more networks
  will be added.
- **FR-23** Foreign keys to `network` MUST be enforced.

---

## 4. Non-Functional Requirements

| # | Requirement | Threshold |
|---|---|---|
| **NFR-1** | Single-product lookup by `(network, external_product_id)` | p95 < 5 ms at 50k products |
| **NFR-2** | Price-series query for one product + one destination | p95 < 200 ms |
| **NFR-3** | Faceted list by category, price band, rating | p95 < 300 ms at 50k products |
| **NFR-4** | Migration apply time, empty → current | < 10 s on SQLite |
| **NFR-5** | Migration idempotency | Re-running applies nothing and loses no data |
| **NFR-6** | Ingest throughput | ≥5,000 rows/s sustained (SPEC-001 NFR-2) |
| **NFR-7** | Retention job impact on serving | < 5% latency increase while running |
| **NFR-8** | Storage overhead vs raw data | ≤ 40% for indices |
| **NFR-9** | Money arithmetic | exact; integer minor units, zero floating point |

---

## 5. Acceptance Criteria

**AC-1** *(FR-1, NFR-4)* — Given an empty directory, when migrations run on
SQLite, then they complete in under 10 s and produce every table in §6.

**AC-2** *(FR-1)* — Given the same migration files, when they run against a fresh
Postgres database, then every table, column, constraint and index exists with the
same names and semantics.

**AC-3** *(FR-5)* — Given migrations, when run twice, then no error occurs and no
existing row is lost.

**AC-4** *(FR-3, NFR-9)* — Given prices of 10.10 and 20.20, when summed and
stored as minor units, then the total is exactly 3030 and re-reads as 30.30. The
equivalent float computation is asserted to be unreliable, documenting why
integers are required.

**AC-5** *(FR-4)* — Given a product ingested twice with different titles, when
queried, then exactly one row exists with the latest title.

**AC-6** *(FR-5, FR-6)* — Given two listings in different networks, when a
cross-listing match is recorded, then **both product rows still exist**, and the
match row carries its confidence and the signals that produced it.

**AC-7** *(FR-7, FR-9)* — Given a price observed for destination `US` and one for
`DE`, when queried by destination, then each returns its own value and neither
overwrites the other.

**AC-8** *(FR-9)* — Given a product with unknown shipping for a destination, when
the row is stored, then shipping is NULL, and a computed total is flagged
`is_complete = false`. **It is not 0, and not silently equal to item price.**

**AC-9** *(FR-3, FR-8)* — Given two price observations in different currencies,
when an arithmetic mean is attempted, then the operation is refused or requires
an explicit conversion — never a raw cross-currency average.

**AC-10** *(FR-10)* — Given an observation with `delivery_bucket_days = 7`, when
stored, then the value 7 is queryable independently of price.

**AC-11** *(FR-13)* — Given a product with NULL `commission_rate`, when ingested,
then `monetisable = false`, and a monetised listing query excludes it.

**AC-12** *(FR-14)* — Given a promotion link stored at time T, when queried, then
`observed_at = T` is returned, so staleness is computable.

**AC-13** *(FR-15)* — Given the retention configuration is changed to 7 days,
when the retention job runs, then rows older than 7 days are removed **without a
migration or code change**.

**AC-14** *(FR-18)* — Given a product with a year of price data and a 7-day raw
retention, when the retention job runs, then the daily rollup for that year is
still queryable.

**AC-15** *(FR-17, NFR-7)* — Given a retention job over a large table, when it is
interrupted midway, when it resumes it continues without re-deleting and without
a long-held transaction.

**AC-16** *(FR-19)* — Given any stored product field, when its provenance is
queried, then the `source` and `source_run_id` are retrievable and the run exists.

**AC-17** *(FR-20)* — Given a safety-excluded product, when the exclusion is
queried, then the category that caused it and the run that excluded it are
recorded.

**AC-18** *(FR-22)* — Given a query for products, when filtered by network, then
results are correct for at least two distinct networks, and no table is
implicitly single-network.

**AC-19** *(FR-23)* — Given an attempt to insert a product with a network that
does not exist, when the FK is enforced, then the insert is rejected.

**AC-20** *(FR-21)* — Given a fixture with a known product, when searched by a
word from its title on **both** engines, then the product is returned.

**AC-21** *(NFR-1, NFR-2, NFR-3)* — Given a fixture at 5,000 products, when the
three benchmark queries run, then each meets its p95 threshold on both engines.

---

## 6. Data Models

Type mapping is the portability strategy:

| Logical | SQLite | Postgres | Note |
|---|---|---|---|
| uuid | `TEXT` | `TEXT` | Portable. Generated app-side. |
| timestamp | `TEXT` (ISO-8601 UTC) | `TIMESTAMPTZ` | SQLite has no native tz type |
| json | `TEXT` | `JSONB` | Portable via text storage |
| money | `INTEGER` (minor) | `BIGINT` | Never float (FR-3) |
| rate | `REAL` | `NUMERIC(6,5)` | Rate ≤ 1.0 with 5dp |
| bool | `INTEGER` | `BOOLEAN` | |

### `network`

| Field | Type | Constraints |
|---|---|---|
| `network_id` | text | **PK** |
| `display_name` | text | NOT NULL |
| `source_kind` | text | NOT NULL — `live-api` \| `file-csv` \| `manual-curated` |
| `commission_model` | text | NOT NULL — `cps` \| `cpa` \| `cpi` \| `report-only` |
| `cookie_window_days` | integer | NULL — 3 for AliExpress (verified) |
| `supports_product_feed` | bool | NOT NULL default false |
| `supports_deep_links` | bool | NOT NULL default false |
| `enabled` | bool | NOT NULL default true |

### `category`

| Field | Type | Constraints |
|---|---|---|
| `category_id` | uuid | **PK** |
| `network_id` | text | FK → `network` |
| `external_id` | text | NOT NULL — e.g. `first_level_category_id` |
| `parent_external_id` | text | NULL |
| `level` | integer | NOT NULL — 1 or 2 |
| `name_en` | text | NOT NULL |
| `name_localised` | json | NULL — `{lang: name}` |
| `is_safety_critical` | bool | NOT NULL default false |

> Unique on `(network_id, external_id, level)`.

### `product`

| Field | Type | Constraints |
|---|---|---|
| `product_id` | uuid | **PK** |
| `network_id` | text | NOT NULL, FK → `network` |
| `external_product_id` | text | NOT NULL — `product_id` from feed |
| `shop_external_id` | text | NULL — `shop_id` |
| `title` | text | NOT NULL |
| `title_localised` | json | NULL — 22 languages available (verified) |
| `detail_url` | text | NOT NULL — `product_detail_url` |
| `category_id` | uuid | NULL, FK → `category` |
| `image_url` | text | NULL — `product_main_image_url` |
| `image_urls` | json | NULL — `product_small_image_urls` |
| `video_url` | text | NULL — `product_video_url` |
| `platform_product_type` | text | NULL — `ALL` \| `PLAZA` \| `TMALL` |
| `evaluate_rate` | real | NULL |
| `lastest_volume` | integer | NULL (vendor's spelling preserved) |
| `monetisable` | bool | NOT NULL default false (FR-13) |
| `safety_excluded` | bool | NOT NULL default false |
| `first_seen_at` | timestamptz | NOT NULL |
| `last_seen_at` | timestamptz | NOT NULL |
| `source` | text | NOT NULL — `csv` \| `api` \| `manual` |
| `source_run_id` | uuid | FK → `ingestion_run` |

> **Unique on `(network_id, external_product_id)`** — the ingest key (FR-4).

### `price_observation` — the core table

| Field | Type | Constraints |
|---|---|---|
| `observation_id` | uuid | **PK** |
| `product_id` | uuid | NOT NULL, FK → `product` |
| `destination_country` | text | NOT NULL — ISO-3166 alpha-2 |
| `observed_at` | timestamptz | NOT NULL |
| `currency` | text | NOT NULL — ISO-4217 (FR-8) |
| `sale_price_minor` | integer | NOT NULL |
| `original_price_minor` | integer | NULL |
| `commission_rate` | numeric | NULL |
| `delivery_bucket_days` | integer | NULL — FR-10 |
| `shipping_minor` | integer | **NULL = unknown** (FR-9) |
| `duty_minor` | integer | **NULL = unknown** |
| `is_complete` | bool | NOT NULL — false if any component unknown |
| `source` | text | NOT NULL |
| `source_run_id` | uuid | FK → `ingestion_run` |

> **Unique on `(product_id, destination_country, observed_at)`**
> Indexes: `(product_id, destination_country, observed_at DESC)` and
> `(observed_at)` for retention sweeps.

### `price_daily_rollup`

Downsampled history that survives raw-data deletion (FR-18).

| Field | Type | Constraints |
|---|---|---|
| `product_id` | uuid | NOT NULL, FK → `product` |
| `destination_country` | text | NOT NULL |
| `day` | date | NOT NULL |
| `currency` | text | NOT NULL |
| `min_price_minor` | integer | NOT NULL |
| `max_price_minor` | integer | NOT NULL |
| `avg_price_minor` | integer | NOT NULL |
| `first_price_minor` | integer | NOT NULL |
| `last_price_minor` | integer | NOT NULL |
| `observations` | integer | NOT NULL |

> **PK `(product_id, destination_country, day)`**

### `product_identity_match` — cross-listing candidates

| Field | Type | Constraints |
|---|---|---|
| `match_id` | uuid | **PK** |
| `product_id_a` | uuid | NOT NULL, FK → `product` |
| `product_id_b` | uuid | NOT NULL, FK → `product` |
| `confidence` | real | NOT NULL — 0.0–1.0 (FR-6) |
| `method` | text | NOT NULL — `image_hash` \| `title_norm` \| `gtin` \| `manual` |
| `signals` | json | NOT NULL — evidence (FR-6) |
| `reviewed_at` | timestamptz | NULL — NULL = unreviewed candidate |
| `review_outcome` | text | NULL — `confirmed` \| `rejected` |

> ⚠️ **Never merged into `product`** (FR-5). Merging destroys per-network
> attribution needed for commission reconciliation.
> Unique on `(product_id_a, product_id_b)` with `product_id_a < product_id_b`.

### `promotion_link`

| Field | Type | Constraints |
|---|---|---|
| `link_id` | uuid | **PK** |
| `product_id` | uuid | NOT NULL, FK → `product` |
| `destination_country` | text | NULL |
| `url` | text | NOT NULL |
| `observed_at` | timestamptz | NOT NULL — FR-14, staleness computable |
| `status` | text | NOT NULL default `unknown` — `valid` \| `invalid` \| `unknown` |

### `safety_exclusion` — audit, not a log line

| Field | Type | Constraints |
|---|---|---|
| `exclusion_id` | uuid | **PK** |
| `run_id` | uuid | NOT NULL, FK → `ingestion_run` |
| `network_id` | text | NOT NULL |
| `external_product_id` | text | NOT NULL |
| `matched_category` | text | NOT NULL — FR-20 |
| `matched_keyword` | text | NOT NULL |
| `title` | text | NULL — retained for audit |

### `retention_policy` — configuration, not code

| Field | Type | Constraints |
|---|---|---|
| `table_name` | text | **PK** |
| `retention_class` | text | NOT NULL |
| `max_age_days` | integer | NOT NULL, **> 0** |
| `basis` | text | NOT NULL — `tos-permitted` \| `derived-aggregate` \| `operator-review` |
| `tos_reference` | text | NULL |
| `rollup_to` | text | NULL — rollup target before deletion |

### `ingestion_run`, `module`, `dead_letter`, `request_ledger`, `ingestion_checkpoint`

As defined in [SPEC-001 §7](../specs/SPEC-001-ingestion-engine.md#7-data-models).

---

## 7. Edge Cases

| # | Case | Required behaviour |
|---|---|---|
| **EC-1** | Product price changes currency between observations | Store both with their own currency. Never compare across (FR-8). |
| **EC-2** | `original_price_minor` < `sale_price_minor` | Store as-is and flag. This is a real upstream anomaly and indicates an unreliable discount — directly relevant to fake-discount detection. **Do not silently correct it.** |
| **EC-3** | Same product, same destination, two observations in the same second | Unique constraint resolves to one row. The later value wins; the run records the skip. |
| **EC-4** | Product appears, then disappears from the feed | Retain the row; mark absent. A missing product is information (it may be delisted), not a deletion. |
| **EC-5** | Destination country unsupported by a network | Store with the country recorded and `is_complete = false`. Never substitute another country (SPEC-001 EC-13). |
| **EC-6** | Retention job runs while ingestion is writing | Batch deletes on `observed_at` ranges older than the cutoff. In-flight rows are outside the range. |
| **EC-7** | Two products share an external id across networks | Legitimate and common. The unique key includes `network_id`, so no collision (FR-22). |
| **EC-8** | Price of 0 | Almost certainly an upstream placeholder, never a real price. Store, but exclude from aggregates and flag. |
| **EC-9** | Extremely large price value (integer overflow) | Reject at validation with a named error. Do not wrap. |
| **EC-10** | `commission_rate` outside [0, 1] | Reject. AliExpress Hot Products advertise up to 90%, which is within range; anything above 1.0 is corrupt. |
| **EC-11** | Localised title missing for a requested language | Fall back to the base title and record which language was actually served. **Never fabricate a translation.** |
| **EC-12** | A migration fails halfway | Must leave the schema in a state where the previous migrations still apply. Transactional DDL where supported; documented where not. |
| **EC-13** | Daily rollup runs while late-arriving data lands | Rollup is idempotent per day; re-running recomputes from raw. Safe to repeat. |
| **EC-14** | `destination_country` arrives as a 3-letter code | Normalise to alpha-2 at ingest, or reject. Store canonical form only. |
| **EC-15** | Product row exists but price observations do not | Valid state (listed, not yet priced). Must not break listing queries or be treated as free. |

---

## 8. API Contracts

```ts
export type Currency = string;              // ISO-4217
export type CountryCode = string;           // ISO-3166 alpha-2

export interface Money {
  readonly minor: number;                  // integer minor units (FR-3)
  readonly currency: Currency;             // never absent (FR-8)
}

export interface PriceObservation {
  readonly productId: string;
  readonly destinationCountry: CountryCode;
  readonly observedAt: string;             // ISO-8601 UTC
  readonly salePrice: Money;
  readonly originalPrice: Money | null;
  readonly commissionRate: number | null;  // 0..1
  readonly deliveryBucketDays: number | null;
  readonly shipping: Money | null;         // null = UNKNOWN (FR-9)
  readonly duty: Money | null;             // null = UNKNOWN
  readonly isComplete: boolean;            // false if any component unknown
}

/** Honest-total contract. Never returns a total pretending to be final. */
export interface LandedCostResult {
  readonly productId: string;
  readonly destinationCountry: CountryCode;
  readonly itemPrice: Money | null;
  readonly shipping: Money | null;
  readonly duty: Money | null;
  readonly total: Money | null;            // null unless isComplete
  readonly isComplete: boolean;
  readonly deliveryBucketDays: number | null;
  readonly unknownComponents: readonly ('shipping' | 'duty' | 'delivery')[];
}

export interface ProductRecord {
  readonly productId: string;
  readonly networkId: string;
  readonly externalProductId: string;
  readonly title: string;
  readonly titleServedLanguage: string;   // may differ from requested (EC-11)
  readonly detailUrl: string;
  readonly imageUrl: string | null;
  readonly videoUrl: string | null;
  readonly evaluateRate: number | null;
  readonly monetisable: boolean;          // FR-13
  readonly safetyExcluded: boolean;
}

export interface IdentityMatchCandidate {
  readonly productIdA: string;
  readonly productIdB: string;
  readonly confidence: number;            // 0..1, never asserted as fact
  readonly method: 'image_hash' | 'title_norm' | 'gtin' | 'manual';
  readonly signals: Readonly<Record<string, number | string>>;
  readonly reviewed: boolean;
}
```

---

## 9. Migration Policy

| Rule | Detail |
|---|---|
| Single source | Same migration files for both engines (FR-1) |
| Ordering | Numbered, immutable once applied |
| Idempotency | Re-running applies nothing (NFR-5) |
| Portability shims | Engine-specific SQL isolated and marked, e.g. `-- @if:postgres` |
| FTS | Separate **optional** migration; a missing FTS index must not block a working install (FR-21) |
| Destructive changes | Require an explicit `-- allow-destructive` flag **and** operator confirmation — R1 applies to schema |
| No down-migrations by default | Data loss must be deliberate, not a reflex of a rollback command |

---

## 10. Out of Scope

| Excluded | Reason |
|---|---|
| **Dedup algorithm implementation** | SPEC-002. This spec only stores match candidates (FR-6). |
| **Search engine internals** | Postgres FTS configuration beyond the schema. Meilisearch/Typesense remain an open option (gap G23). |
| **Click/conversion analytics** | Blocked on the tracking decision (issue #2). Tables land when that decision is made. |
| **Commission reconciliation / payouts** | Requires a live dashboard and credentials. |
| **B2B (Alibaba.com) entities** | Quote requests, suppliers, RFQ — deferred per D-009. Needs `TradeCompleted` handling. |
| **User accounts, subscriptions, auth** | No user-facing accounts in scope. |
| **Full-text ranking tuning** | Out of scope until real query logs exist. |
| **Partitioning** | Unnecessary at 28 GB projected (§2). Revisit at ~500 GB. |
| **Image storage / CDN** | Images are referenced by URL, not stored. |
| **Time-series compression** | Premature at this size; complicates the query layer. |

---

## 11. Open Questions

| # | Question | Blocking? |
|---|---|---|
| Q1 | Assumption A1 (50k products) depends on the real quota (G3) | **No for the schema** — sizing informs tuning, not structure |
| Q2 | Retention maximums (M6, ToS clauses) | **No** — FR-15 makes them configuration; values tighten later |
| Q3 | Does the AliExpress API return shipping cost per destination? | **Yes for landed-cost completeness** — if not, `shipping_minor` stays NULL and the UI must say so |
| Q4 | Is `shipping_minor` obtainable from `hotproduct.download` specifically? | Yes — must be checked on first live call |
| Q5 | Downsample interval: daily rollup assumed | No — configurable |

**Verified and relied upon:** field names, the `(product, destination)` pricing
semantics implied by `ship_to_country`, `delivery_bucket_days` from
`delivery_days`, `monetisable` derivable from `commission_rate`. All captured
2026-10-08 from vendor documentation — see
[`research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md`](../../research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md).

**Explicitly unverified and flagged in §2:** all sizing assumptions. **Q3/Q4 are
the ones that could change what we can honestly claim to users.**
