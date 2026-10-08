# SPEC-001 — Ingestion Engine

| Field | Value |
|---|---|
| **ID** | SPEC-001 |
| **Status** | **Approved** |
| **Author** | orchestrating agent |
| **Date** | 2026-10-08 |
| **Reviewers** | operator (pending) · architect agent (pending) |
| **Supersedes** | — |
| **Evidence** | [`research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md`](../../research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md) · [`docs/wiki/30-api-reference/ALIEXPRESS-API.md`](../../docs/wiki/30-api-reference/ALIEXPRESS-API.md) |

---

## 1. Context

We need a repeatable way to get product data from affiliate networks into our
database. Two facts shape this spec.

**First, we do not control API access timing.** The AliExpress Affiliate API
requires a Portals account, a separate Open Platform app of type "Affiliate API",
and a business licence — followed by manual review reported at ~2 business days.
That review is outside our control. Building directly against the live API means
engineering blocks on a queue we cannot hurry.

**Second, the API's real shape was only verified on 2026-10-08**, and it revealed
something that makes an abstraction genuinely worthwhile rather than
premature: two *different* kinds of source must coexist.

- **Feed sources** (AliExpress `hotproduct.download`, Amazon Creators API)
  return product records with prices, categories and commission rates.
- **Report-only networks** (CJ, Awin, Impact) expose publisher APIs for clicks,
  conversions and commissions but **no product feed at all**.
- **Sources with no API whatsoever** (Temu — verified: both partner pages are
  JavaScript shells) can still be curated by a human into a CSV.

Three shapes, one engine. A contract that pretended otherwise would be wrong.

This spec defines the interface and the pipeline. It does not define the schema
(SPEC-003) or the web layer (SPEC-004).

---

## 2. Functional Requirements

### The module contract

- **FR-1** The system MUST define a single `ModuleContract` interface that every
  network integration implements. There MUST be no per-network special-casing in
  the engine.
- **FR-2** `ModuleContract` MUST declare capability flags rather than assuming one
  shape. At minimum:
  ```ts
  interface ModuleCapabilities {
    readonly supportsProductFeed: boolean;
    readonly supportsDeepLinks: boolean;
    readonly supportsConversionReporting: boolean;
    readonly supportsBulkDownload: boolean;
  }
  ```
- **FR-3** Each module MUST declare a per-source `retentionPolicy` (see FR-11).
- **FR-4** Each module MUST declare `identifierStrategy` — how it resolves product
  identity within its network (see SPEC-002).
- **FR-5** Each module MUST provide a `healthCheck()` returning reachability,
  last-success timestamp and observed rate-limit state.

### Sources

- **FR-6** The engine MUST support at least three source kinds behind `ModuleContract`:
  `live-api`, `file-csv`, and `manual-curated`. A network with no API MUST be
  supportable as `manual-curated` with no code change to the engine.
- **FR-7** The engine MUST be able to run fully with **zero** live API credentials,
  using only CSV fixtures. This MUST NOT be a reduced or degraded mode — it is
  the primary development and verification path.
- **FR-8** CSV ingestion MUST validate a declared schema before ingesting and
  MUST reject the whole batch on a schema mismatch, reporting the offending
  column and row. Partial ingestion of a malformed feed is prohibited.

### Idempotency and correctness

- **FR-9** Every write MUST be an idempotent upsert keyed on
  `(network, external_product_id)`. Re-running ingestion of identical input MUST
  leave the database in an identical state.
- **FR-10** Ingestion MUST be resumable. A run interrupted at 40% MUST be able to
  continue without duplicating or losing rows.
- **FR-11** Retention MUST be first-class at the schema level. Every stored field
  MUST belong to a retention class with an explicit maximum age. A module MUST NOT
  be able to write a row that lacks a retention class. This exists because
  affiliate API terms may forbid long-term storage, and discovering that after the
  schema is built would force a rewrite (decision D-013, risk R-003).

### Rate limiting and failure handling

- **FR-12** Every outbound request MUST pass through a per-module token-bucket
  limiter configured from `ModuleContract.rateLimits`.
- **FR-13** On HTTP 429 or a rate-limit signal, the engine MUST apply exponential
  backoff **with jitter** and MUST respect any `Retry-After` header.
- **FR-14** The engine MUST maintain a **daily request budget per module**, spent
  down as requests are made. When exhausted, the module MUST stop cleanly and
  report exhaustion — it MUST NOT continue and risk being blocked.
- **FR-15** Every source error MUST land in a dead-letter queue with the module,
  the entity reference, the error class and the payload hash. Dead-letter entries
  MUST be replayable individually.
- **FR-16** A module failure MUST NOT abort other modules in the same run. Partial
  success is the normal case and MUST be reported as such.

### Observability

- **FR-17** Every ingestion run MUST emit a structured record: module, source
  kind, rows read, rows written, rows skipped, duplicates, errors, requests spent,
  duration, and start/end timestamps.
- **FR-18** Every write MUST record `source` (`csv` | `api` | `manual`) and
  `source_run_id`, so any stored value can be traced back to the run that
  produced it.

### Commission-aware ingestion

- **FR-19** A product MUST carry its commission rate at ingest. Rows with no
  commission rate MUST be flagged `monetisable = false` rather than silently
  stored as if they were earning.
- **FR-20** Ingestion MUST filter on the configured safety-critical category
  exclusion list (D-012) **before** write. Excluded rows MUST be counted and the
  reason logged. The exclusion list MUST be configuration, not a hardcoded filter.

### Destination-aware pricing

- **FR-21** The contract MUST support per-destination price observation. Where a
  module supports it (AliExpress does, via `ship_to_country` and `delivery_days`),
  the engine MUST store price observations keyed by destination country, and MUST
  record delivery-time buckets where provided.
- **FR-22** Where a destination's price or delivery time is **unknown**, the engine
  MUST store absence explicitly. It MUST NOT write a zero, and it MUST NOT write a
  value inherited from a different destination.

---

## 3. Non-Functional Requirements

| # | Requirement | Threshold | Notes |
|---|---|---|---|
| **NFR-1** | Idempotency | Re-ingesting identical input changes **0** rows | Verified by F012 |
| **NFR-2** | Throughput | ≥5,000 rows/sec sustained on CSV import, single process | Sized to the verified field set, not a guess |
| **NFR-3** | p95 lookup | <50 ms for a single product by `external_product_id` | |
| **NFR-4** | Clock skew tolerance | Signing MUST succeed with **≥11 min** offset from GMT+8 | Vendor allows 10 min error; we hold 1 min margin |
| **NFR-5** | Retry safety | Zero duplicate writes under 10,000 simulated request failures | |
| **NFR-6** | Auditability | 100% of stored values traceable to `(source, source_run_id)` | Per FR-18 |
| **NFR-7** | Dead-letter replay | A replayed entry succeeds without manual data surgery | |
| **NFR-8** | Zero-credential startup | Engine starts, ingests fixtures, and serves lookups with **no** API keys present | Per FR-7 |
| **NFR-9** | Retention enforcement | A scheduled job deletes expired data per retention class; **zero** violations detectable | Per FR-11 |

---

## 4. Acceptance Criteria

**AC-1** *(FR-1, FR-2)* — Given the engine and three modules (AliExpress, a
report-only network, a curated CSV source), when modules are registered, then all
three register without modifying engine code, and their capability flags differ
correctly.

**AC-2** *(FR-6)* — Given a network with no API, when it is ingested as a
`manual-curated` source, then it requires no engine change and produces rows
identical in shape to a `live-api` source.

**AC-3** *(FR-7, NFR-8)* — Given **no** API credentials in the environment, when
the documented ingest command runs against a CSV fixture, then it exits zero,
writes rows, and the lookup API serves them.

**AC-4** *(FR-9, NFR-1)* — Given a fixture of N rows, when ingested twice, then
the product count is N both times and a checksum of all mutable fields is
identical across runs.

**AC-5** *(FR-9)* — Given a fixture, when one field of one row is changed and
re-ingested, then exactly one row differs from the prior state.

**AC-6** *(FR-8)* — Given a CSV missing a declared required column, when
ingested, then the batch is rejected, the run exits non-zero, and the error names
the column. **Zero** rows are written.

**AC-7** *(FR-10)* — Given an ingestion interrupted at 40%, when resumed from the
last checkpoint, then the final state is identical to an uninterrupted run.

**AC-8** *(FR-12, FR-14)* — Given a module with a daily budget of 100, when the
budget is exhausted, then the module stops, reports exhaustion, and the total
requests spent that day is **exactly** 100.

**AC-9** *(FR-13)* — Given a source returning 429 with `Retry-After: 30`, when
retried, then the engine waits **at least** 30 s, and backoff between attempts
increases with jitter.

**AC-10** *(FR-15, NFR-7)* — Given a row that fails validation, when the run
completes, then it is in the dead-letter queue with module, reference, error class
and payload hash; and when replayed after the cause is fixed, it succeeds with no
manual data surgery.

**AC-11** *(FR-16)* — Given two modules where one fails entirely, when the run
completes, then the other module's rows are ingested and the run is reported as
**partial success**, not failure.

**AC-12** *(FR-17, NFR-6)* — Given any completed run, when the run record is read,
then it includes every metric in FR-17, and every written row's `source_run_id`
matches that run.

**AC-13** *(FR-19)* — Given a product with `commission_rate = null`, when ingested,
then `monetisable = false` and the product is excluded from monetised listings.

**AC-14** *(FR-20)* — Given a fixture containing batteries, chargers, PPE and
baby-goods rows plus normal rows, when ingested, then only normal rows are stored,
the excluded count is reported, the category is logged per row, and the exclusion
list is editable without a code change.

**AC-15** *(FR-21)* — Given a product priced for country A, when price observations
are stored for A and B, then both are retained separately and neither overwrites
the other.

**AC-16** *(FR-22, NFR-9)* — Given a destination with unknown shipping, when stored,
then the record marks it unknown — **not** zero — and a total computed from it is
marked incomplete rather than presented as final.

**AC-17** *(FR-3, FR-11)* — Given a module declares a retention class, when data
older than that class's maximum age passes the scheduled cleanup, then it is
removed, and a row whose class would be violated is rejected at write.

**AC-18** *(NFR-4)* — Given the local clock offset by 11 minutes from GMT+8, when a
signed request is made, then it is accepted; and at 30 minutes offset it is
rejected locally with a clear error **before** consuming a request from the budget.

**AC-19** *(FR-4)* — Given two modules with different identifier strategies, when
both ingest a product, then each resolves identity by its own declared strategy and
the two do not collide in the identity layer.

**AC-20** *(FR-5)* — Given a module whose upstream is down, when `healthCheck()` is
called, then it reports unreachable with a last-success timestamp, and the run
scheduler skips that module without failing the scheduler.

---

## 5. Edge Cases

| # | Case | Required behaviour |
|---|---|---|
| **EC-1** | API returns 200 with an empty body | Treat as **no data**, not as zero products. Log distinctly — an empty body often indicates a broken auth flow, not an empty catalogue. |
| **EC-2** | Response schema drifts (field renamed/removed) | Quarantine the batch to dead-letter. **Do not** silently write nulls over good data. |
| **EC-3** | `timestamp` outside the 10-min window | Fail fast with a clock-skew error naming the offset. Do not burn request budget. |
| **EC-4** | Product appears with a different `product_id` but identical images/title | Not an ingestion error — hand to the identity layer (SPEC-002). Must not create a duplicate *within* the same network. |
| **EC-5** | Currency changes between runs | Never compare or average across currencies. Store the currency alongside every price (AC-15). |
| **EC-6** | CSV is truncated mid-file (partial download) | Detect via declared row count or parse error; reject whole batch (FR-8). A truncated feed must never ingest as a complete one. |
| **EC-7** | Duplicate rows inside one CSV | Last-write-wins within the batch, counted in `rows_skipped`. |
| **EC-8** | Rate limit hit at the *first* request of a day | Do not retry immediately. Stop, report budget exhaustion, schedule next attempt outside the window. |
| **EC-9** | Module declares no retention class | **Reject at registration**, not at first write. Fail fast on configuration. |
| **EC-10** | Network returns a `promotion_link` that 404s later | Links are volatile. Store them with a fetch timestamp and treat them as **revalidatable**, not permanent. |
| **EC-11** | Safety-exclusion list is empty/misconfigured | Refuse to start. An empty exclusion list silently disables the safety control (D-012). |
| **EC-12** | Two modules claim the same network id | Reject the second registration. Identity collisions must be impossible, not merely unlikely. |
| **EC-13** | Destination country not supported by the module | Record the observation as unsupported for that module. Never substitute another country's price. |
| **EC-14** | Disk full mid-run | Checkpoint, stop cleanly, resume after space is freed. Never leave a half-written batch. |

---

## 6. API Contracts

```ts
// ---------- Module contract ----------

export type SourceKind = 'live-api' | 'file-csv' | 'manual-curated';

export interface ModuleCapabilities {
  readonly supportsProductFeed: boolean;
  readonly supportsDeepLinks: boolean;
  readonly supportsConversionReporting: boolean;
  readonly supportsBulkDownload: boolean;
}

export interface RetentionClass {
  readonly name: string;              // e.g. 'transient' | 'price-history' | 'catalogue'
  readonly maxAgeDays: number;        // MUST be > 0
  readonly basis: 'tos-permitted' | 'derived-aggregate' | 'operator-review';
}

export interface RateLimits {
  readonly requestsPerSecond?: number;
  readonly requestsPerDay?: number;   // daily budget (FR-14)
}

export interface HealthStatus {
  readonly reachable: boolean;
  readonly lastSuccessAt: Date | null;
  readonly rateLimitState: 'ok' | 'throttled' | 'exhausted' | 'unknown';
}

export interface RawProductRecord {
  readonly network: string;
  readonly externalProductId: string;
  readonly title: string;
  readonly categoryPath: readonly string[];
  readonly price: Money | null;
  readonly originalPrice: Money | null;
  readonly commissionRate: number | null;   // null ⇒ monetisable=false (FR-19)
  readonly destinationCountry?: string;     // FR-21
  readonly deliveryBucketDays?: number;     // FR-21
  readonly raw: Record<string, unknown>;    // preserved for forensics
}

export interface Money {
  readonly amount: number;
  readonly currency: string;   // never normalised away (EC-5)
}

export interface ModuleContract {
  readonly id: string;
  readonly network: string;
  readonly sourceKind: SourceKind;
  readonly capabilities: ModuleCapabilities;
  readonly retentionPolicy: RetentionClass;    // MUST NOT be absent (EC-9)
  readonly rateLimits: RateLimits;
  readonly identifierStrategy: string;
  healthCheck(): Promise<HealthStatus>;
  fetchBatch(cursor: Cursor | null): Promise<{
    records: readonly RawProductRecord[];
    nextCursor: Cursor | null;
  }>;
}
```

```ts
// ---------- Engine ----------

export interface IngestionRun {
  readonly runId: string;
  readonly moduleId: string;
  readonly sourceKind: SourceKind;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly rowsRead: number;
  readonly rowsWritten: number;
  readonly rowsSkipped: number;
  readonly rowsExcludedSafety: number;
  readonly deadLettered: number;
  readonly requestsSpent: number;
  readonly outcome: 'success' | 'partial' | 'failed' | 'budget-exhausted';
}

export interface IngestionEngine {
  register(m: ModuleContract): void;                       // throws on EC-9, EC-12
  run(moduleId: string, opts?: { resumeFrom?: Cursor }): Promise<IngestionRun>;
  runAll(): Promise<readonly IngestionRun[]>;              // isolates failures (FR-16)
  replayDeadLetter(id: string): Promise<void>;
  health(): Promise<readonly { moduleId: string; status: HealthStatus }[]>;
}
```

```ts
// ---------- Errors ----------

export class IngestionError extends Error {
  constructor(
    readonly code:
      | 'SCHEMA_MISMATCH' | 'CLOCK_SKEW' | 'RATE_LIMITED'
      | 'BUDGET_EXHAUSTED' | 'AUTH_FAILED' | 'EMPTY_RESPONSE'
      | 'SCHEMA_DRIFT' | 'TRUNCATED_SOURCE' | 'RETENTION_UNDEFINED'
      | 'SAFETY_LIST_INVALID' | 'NETWORK_ID_CONFLICT' | 'UNSUPPORTED_DESTINATION',
    message: string,
    readonly retryable: boolean,
  ) { super(message) }
}
```

---

## 7. Data Models

Owned by SPEC-003; this spec fixes only the ingestion-side entities.

### `ingestion_run`

| Field | Type | Constraints |
|---|---|---|
| `run_id` | uuid | PK |
| `module_id` | text | NOT NULL, FK → `module` |
| `source_kind` | enum | `live-api` \| `file-csv` \| `manual-curated` |
| `started_at` | timestamptz | NOT NULL |
| `finished_at` | timestamptz | NULL until complete |
| `rows_read` | int | ≥0 |
| `rows_written` | int | ≥0 |
| `rows_skipped` | int | ≥0 |
| `rows_excluded_safety` | int | ≥0 |
| `dead_lettered` | int | ≥0 |
| `requests_spent` | int | ≥0 |
| `outcome` | enum | `success` \| `partial` \| `failed` \| `budget-exhausted` |

### `module`

| Field | Type | Constraints |
|---|---|---|
| `module_id` | text | PK, unique |
| `network` | text | NOT NULL, **unique** (EC-12) |
| `source_kind` | enum | NOT NULL |
| `capabilities` | jsonb | NOT NULL |
| `retention_class` | text | NOT NULL, FK → `retention_class` (EC-9) |
| `requests_per_day` | int | NULL |
| `identifier_strategy` | text | NOT NULL |
| `enabled` | bool | default true |

### `retention_class`

| Field | Type | Constraints |
|---|---|---|
| `name` | text | PK |
| `max_age_days` | int | NOT NULL, **> 0** |
| `basis` | enum | `tos-permitted` \| `derived-aggregate` \| `operator-review` |
| `tos_reference` | text | NULL — cite the clause when `basis='tos-permitted'` |

### `dead_letter`

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `run_id` | uuid | FK → `ingestion_run` |
| `module_id` | text | NOT NULL |
| `entity_ref` | text | NULL |
| `error_code` | text | NOT NULL |
| `error_class` | text | NOT NULL |
| `payload_hash` | text | NOT NULL |
| `payload` | jsonb | NOT NULL |
| `attempts` | int | default 0 |
| `replayed_at` | timestamptz | NULL |

### `request_ledger`

| Field | Type | Constraints |
|---|---|---|
| `module_id` | text | PK part |
| `day` | date | PK part |
| `requests_spent` | int | NOT NULL default 0 |
| `budget` | int | NOT NULL |

### `ingestion_checkpoint`

| Field | Type | Constraints |
|---|---|---|
| `module_id` | text | PK |
| `cursor` | jsonb | NULL |
| `rows_committed` | int | NOT NULL default 0 |
| `updated_at` | timestamptz | NOT NULL |

> **Note (FR-21 + EC-13):** destination-keyed price observations live in the
> price-history tables defined by SPEC-003. This spec requires the shape
> `(product, destination_country, observed_at)` and explicit nullability, but
> does not fix the table.

---

## 8. Out of Scope

| Excluded | Reason |
|---|---|
| **Product dedup / cross-listing identity** | SPEC-002. This spec only requires identity to be *pluggable* (FR-4). |
| **Schema, indexes, migrations** | SPEC-003 |
| **Site rendering, `.md` twins, llms.txt** | SPEC-004 |
| **Affiliate link construction** | SPEC-005, except storing a module-provided `promotion_link` |
| **Conversion / commission reporting ingestion** | Declared as a capability (FR-2) but no report-only module ships in this spec. Tier-2 networks are phase 4. |
| **Order-level reconciliation** | Requires a live commission dashboard; blocked on credentials. |
| **Landed-cost computation** | This spec *stores* destination price and delivery buckets; computing a total is a separate feature with its own honesty requirements (FR-22). |
| **A real Amazon module** | Needs Creators API credentials; SPEC-003 will host the schema, the module ships when keys exist. |
| **Temu module** | **Verified: no public API** (see [TEMU](../../docs/wiki/10-platforms/TEMU.md)). Curated CSV only. |
| **Scheduled/continuous operation** | A scheduler exists (`health()`, AC-20) but cron/CI wiring is SPEC-005 scope. |
| **Multi-tenant operation** | Not needed for a single-operator business. |
| **Any auto-scraping of JS-only portals** | Explicitly rejected on principle (D-012 sibling). No scraping of Temu or any ToS-restricted surface. |

---

## 9. Open Questions

| # | Question | Blocking? |
|---|---|---|
| Q1 | Exact daily request quota (gap G3) | **Yes for tuning FR-14/NFR** — engine must be built with a configurable budget regardless |
| Q2 | Does a registered non-Chinese business qualify (gap G4)? | **No** — CSV path (FR-7) makes this non-blocking for the first vertical slice |
| Q3 | Retention maximums per class (gap: ToS clauses) | **No for structure** — FR-11 requires the field; values can be tightened later |
| Q4 | Is `promotion_link` stable or per-request (EC-10)? | No — EC-10 already handles it defensively |

**Verification already claimed as HARD FACT:** endpoint names, gateway, signing
algorithm (`hmac`/`md5`), field names, `ship_to_country` tax-policy behaviour,
10-minute clock-skew tolerance — all captured verbatim from the vendor
documentation on 2026-10-08. See
[`research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md`](../../research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md).

**Still UNVERIFIED and deliberately marked so:** quota magnitude, eligibility
policy, live response shape.
