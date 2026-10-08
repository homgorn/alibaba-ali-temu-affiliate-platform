# SPEC-002 — Product Identity & Cross-Listing Deduplication

| Field | Value |
|---|---|
| **ID** | SPEC-002 |
| **Status** | **Approved** |
| **Author** | orchestrating agent |
| **Date** | 2026-10-08 |
| **Reviewers** | operator (pending) |
| **Depends on** | SPEC-003 (schema — `product_identity_match`), SPEC-001 (FR-4, FR-5) |
| **Evidence** | [`research/raw/r04-feeds-data-eng/001-aliexpress-product-id-systems.md`](../../research/raw/r04-feeds-data-eng/001-aliexpress-product-id-systems.md) · [`002-product-deduplication-techniques.md`](../../research/raw/r04-feeds-data-eng/002-product-deduplication-techniques.md) |

---

## 1. Context

We will hold the same physical product sold by different sellers, in different
networks, under different titles and images. Our highest-value product
(comparison pages, landed cost) is worthless if it compares a product with
itself, and actively harmful if it compares two different products as if they
were the same.

### The core constraint, verified

From IEEE TKDE (2026-08-01):

> "The aggregation of highly heterogeneous product listings across online
> webshops suffers from severe scalability limitations and high false positive
> rates, as **identifying duplicates without universal product identifiers**
> typically requires computationally expensive pairwise comparisons."

⚠️ **There is no universal product identifier.** GTIN/EAN exists in theory but on
marketplace listings it is frequently absent, and where present it is sometimes
faked by sellers. An ASIN is Amazon-only and means nothing for an AliExpress
listing.

### ⭐ The decision this spec makes, and why it is not the "obvious" one

The available research describes sophisticated solutions:

| Source | Approach | Scale | Reported |
|---|---|---|---|
| Hepsiburada (arXiv 2509.15858) | BERT + MAE embeddings, **128-dim**, Milvus | **116M vectors/day** | macro-F1 **0.90** vs 0.83 third-party |
| IEEE TKDE (2026) | Fast Similarity Sketching + LSH amplification | large | better than MinHash baseline |
| MDPI Electronics (2024) | Perceptual hashing (AHash/DHash/PHash/WHash) | general | baseline |

**Our projected scale is 50,000 products** (SPEC-003 §2). The Hepsiburada system
runs at **116 million vectors daily**.

**INFERENCE (high confidence): deploying a transformer embedding pipeline for
50,000 products would be a category error.** At 50k, brute-force comparison of
every pair is 50,000² / 2 ≈ **1.25 billion comparisons** — heavy but tractable,
and vastly simpler than maintaining a vector database. The sophisticated
approach's advantage is *throughput at billions of items*; we have no such
problem, and would inherit its cost without its benefit.

MDPI's caveat reinforces this — and cuts the other way:

> "learned deep embeddings are far more effective than perceptual hashing
> methods at preserving discriminative information **in visually diverse and
> heavily transformed product images**."

Our images are **not** visually diverse — marketplace product photos are
typically the same white-background studio shot. Perceptual hashing should work
well here. **This is a favourable property of our domain, and it is why the
simple approach is correct for us.**

⚠️ **Both claims are INFERENCE from scale arithmetic and domain knowledge, not
measurement.** The plan therefore includes a **measured baseline** (FR-10) before
committing to the simple approach as final.

---

## 2. Functional Requirements

### 2.1 Within-network identity (the easy case)

- **FR-1** Within a single network, identity MUST be `(network,
  external_product_id)` — already enforced by SPEC-003. **No heuristic needed
  within a network.** This is the majority of rows and MUST NOT go through
  matching at all.
- **FR-2** A product whose title or image changes MUST retain its identity. Feed
  updates are not new products.

### 2.2 Variant vs distinct product

- **FR-3** The system MUST distinguish a **variant** of a product (different size,
  colour, capacity) from a **distinct product**. A 500ml and a 1L bottle of the
  same product line are variants; a different product line is not.
- **FR-4** Variant grouping MUST be scoped **within a network**. Amazon's verified
  `GetVariations` returns "a set of items that are the same product, but differ
  according to a consistent theme, for example size and color" — a network-native
  signal we can use where available, and must not assume exists elsewhere.
- **FR-5** Where a network provides a parent/variant grouping, it MUST be
  preferred over our own heuristic and MUST be stored as such (provenance).

### 2.3 Cross-network matching (the hard case)

- **FR-6** Cross-network matching MUST produce **scored candidates**, never
  automatic merges (SPEC-003 FR-5/FR-6, decision D-027).
- **FR-7** Matching MUST combine **multiple independent signals**. A match
  asserted from a single signal MUST NOT reach high confidence.
- **FR-8** Required signals, each independently available:
  | Signal | Source | Availability |
  |---|---|---|
  | Perceptual image hash | `product_main_image_url` (verified CDN URL) | AliExpress ✅ |
  | Normalised title | `product_title` (22 languages verified) | AliExpress ✅ |
  | Category path | `first/second_level_category_*` (verified) | AliExpress ✅ |
  | Price band | `sale_price` in comparable currency | AliExpress ✅ |
  | GTIN/EAN | — | ⚠️ **rarely present; never required** |
- **FR-9** Every candidate MUST record **which signals fired and their individual
  scores**, so a reviewer can see why it was proposed (SPEC-003 FR-6). A bare
  confidence number is not auditable.
- **FR-10** The system MUST produce a **measured baseline** of precision/recall
  on a hand-labelled sample **before** the matching approach is treated as
  final. A threshold set without measurement is a guess.

### 2.4 Confidence semantics

- **FR-11** Confidence MUST be interpretable and MUST NOT be presented as
  probability. It is a **similarity score**, not a calibrated likelihood.
- **FR-12** High confidence MUST require agreement across **at least two
  independent signal families** (e.g. image **and** title). A single-family match
  caps at medium.
- **FR-13** The system MUST be able to emit **"insufficient evidence"** rather
  than forcing a candidate. Silence is a valid output.
- **FR-14** Category mismatch MUST **cap** confidence regardless of how well the
  images match — same photo in a wrong category is usually a listing error, not
  a match.

### 2.5 Performance

- **FR-15** Matching MUST be **incremental**, not a full re-scan. Ingesting one
  new product MUST NOT recompute matches for the whole catalogue.
- **FR-16** A blocking function MUST be used to avoid all-pairs comparison at
  scale. Even at 50k, narrowing candidates first is materially cheaper and is
  the mechanism that would still work at 10× the size.
- **FR-17** Matching MUST NOT run inside the ingestion transaction. It MUST be a
  separate, resumable pass, so a matching failure cannot fail an ingest (SPEC-001
  FR-16).

### 2.6 Data hygiene

- **FR-18** Upstream attribute duplication MUST be handled. Verified:
  "attributes often contains duplicate `{ name, value }` pairs (basic + other
  property blocks); consumers should dedupe if needed."
- **FR-19** The system MUST NOT invent a GTIN. Where absent, record absence.

---

## 3. Non-Functional Requirements

| # | Requirement | Threshold |
|---|---|---|
| **NFR-1** | Candidate recall on a hand-labelled 500-pair sample | ≥ 0.90 |
| **NFR-2** | Candidate precision at the "propose for review" threshold | ≥ 0.85 |
| **NFR-3** | p95 incremental match latency, one new product | < 500 ms |
| **NFR-4** | Full-catalog matching pass, 50k products | < 10 min |
| **NFR-5** | Match pass memory ceiling | < 512 MB |
| **NFR-6** | Reviewer can explain any candidate | Every candidate lists firing signals (FR-9) |
| **NFR-7** | Matching never blocks ingestion | Measured: 0 added latency to ingest transaction |

⚠️ **NFR-1/NFR-2 are target thresholds, not measured results.** Until FR-10's
baseline runs, the true values are unknown and both are `UNVERIFIED`.

---

## 4. Acceptance Criteria

**AC-1** *(FR-1)* — Given 1,000 products from one network, when re-ingested with
changed titles, then zero new identity matches are computed, because
within-network identity is not heuristic.

**AC-2** *(FR-2)* — Given a product whose image and title both change upstream,
when re-ingested, then it retains the same `product_id`.

**AC-3** *(FR-3)* — Given two listings differing only in size (500ml vs 1L), when
matched, then they are recorded as **variants** of one product group, not as
duplicate listings.

**AC-4** *(FR-3)* — Given two listings from different product lines in the same
category, when matched, then they are **not** recorded as variants.

**AC-5** *(FR-4)* — Given a network that provides parent/variant grouping, when
the grouping is available, then it is used and recorded with that provenance, and
our heuristic is not the source of the grouping.

**AC-6** *(FR-6)* — Given two products in different networks that match, when the
match is stored, then **both product rows still exist** and the match row
carries `confidence`, `method` and `signals`.

**AC-7** *(FR-7, FR-12)* — Given two products whose images match strongly but
whose titles share no tokens, when matched, then confidence **does not** reach
the high band, because only one signal family fired.

**AC-8** *(FR-7)* — Given two products whose image hash matches exactly, when
matched, then the `signals` field lists which signals fired — **not just a
number**.

**AC-9** *(FR-9, NFR-6)* — Given any stored candidate, when inspected, then a
reviewer can determine the reason without recomputation.

**AC-10** *(FR-13)* — Given a product with no comparable signal in the target
network, when matching runs, then **no candidate is emitted** — and that absence
is recorded, not treated as "no match found".

**AC-11** *(FR-14)* — Given identical images in **different categories**, when
matched, then confidence is capped regardless of image similarity.

**AC-12** *(FR-15)* — Given one new product ingested, when matching runs, then
only that product is evaluated against blocked candidate sets — the pass does not
re-scan the catalogue.

**AC-13** *(FR-16)* — Given 50,000 products, when a full match pass runs, then
the number of **pairwise comparisons performed is materially below** the
all-pairs count of 1.25 × 10⁹, proving blocking works.

**AC-14** *(FR-17)* — Given a matching pass that fails mid-run, when ingestion
continues, then ingestion is unaffected and the match pass can resume from its
last checkpoint.

**AC-15** *(FR-18)* — Given a raw attribute payload with duplicate
`{name, value}` pairs, when normalised, then each unique pair appears once.

**AC-16** *(FR-19)* — Given a product with no GTIN, when stored, then no GTIN is
invented and the absence is explicit.

**AC-17** *(FR-10)* — Given a hand-labelled 500-pair sample, when the baseline
runs, then precision and recall are recorded in the wiki with the **sample
composition**, and the threshold is set from the measurement.

**AC-18** *(NFR-4)* — Given 50,000 products, when a full match pass runs, then it
completes in under 10 minutes and peaks under 512 MB.

---

## 5. Edge Cases

| # | Case | Required behaviour |
|---|---|---|
| **EC-1** | Same photo reused by an unrelated seller for a different product | Category/title disagreement caps confidence (FR-14). Never auto-merged in any case. |
| **EC-2** | Identical title, different product (generic names like "Wireless Earbuds") | Title alone cannot reach high confidence (FR-12). Extremely common — generic titles are the norm, not the exception. |
| **EC-3** | Same product, completely different images (different photo shoot) | No image signal. If title+category agree, emit a **medium** candidate — honest, not confident. |
| **EC-4** | Same product, translated title (RU vs EN) | Normalisation must handle cross-language. ⚠️ **Cross-lingual title similarity is explicitly UNVERIFIED** — translation-based matching is out of scope (see §10). |
| **EC-5** | Bundle vs single item ("2-pack" vs "1") | Distinct offer, not a duplicate. Detect quantity tokens. |
| **EC-6** | Image CDN URL changes but image is identical | Hash the **image content**, not the URL. A URL hash would produce a false negative. |
| **EC-7** | Duplicate listing **within** one network (same product, two `product_id`s) | Not our problem — different rows, both valid. May surface as a cross-match only if we match within-network, which FR-1 forbids. Deliberate. |
| **EC-8** | Product disappears then reappears with a new `product_id` | A **new** product. Do not attempt resurrection — the price history would be wrong. |
| **EC-9** | Very long title truncated upstream | Normalise defensively; never crash. |
| **EC-10** | All three images for a product are identical (seller reused one photo) | Hash the first, but record that only one distinct image exists. |
| **EC-11** | Price differs by >50% for image+title match | Still emit the candidate but flag the price disagreement — likely a different variant, quantity, or a scam listing. **Never** auto-merge. |
| **EC-12** | Category taxonomy differs between networks (no shared taxonomy) | Category signal unavailable → its absence caps achievable confidence. Must be recorded, not silently skipped. |
| **EC-13** | Adversarial seller copies a competitor's photos **and** title | Our signals are all copyable. ⚠️ **Known limitation** — image+title similarity cannot prove two listings are the same *merchant's* product. Never claim otherwise in the UI. |
| **EC-14** | Hash collision on genuinely different images | Perceptual hashing has collisions. A match is a **candidate**, so a collision costs a review, not a wrong merge. This is precisely why FR-6 forbids merging. |

---

## 6. Matching Algorithm (proposed)

```
PHASE A — blocking (avoid all-pairs)
  key = (category_id, rounded_price_band, title_token_prefix)
  → only compare within blocks

PHASE B — signal extraction
  s_image  = 1 - (hamming(phash_a, phash_b) / 64)      // 0..1
  s_title  = jaccard(normalised_tokens(a), normalised_tokens(b))
  s_cat    = 1 if category paths agree else 0
  s_price  = 1 - min(|p_a - p_b| / max(p_a, p_b), 1)

PHASE C — combination
  require >= 2 independent families agreeing        (FR-7, FR-12)
  confidence = weighted sum of firing signals
  cap at medium if < 2 families                      (FR-12)
  cap at low    if s_cat = 0                         (FR-14)
  cap at low    if price disagreement > 50%          (EC-11)

PHASE D — emit
  store candidate with method + all four s_* values   (FR-9)
  never merge                                        (FR-6)
```

**Image hashing method:** PHash (DCT-based, frequency domain) preferred over
AHash/DHash, because product images vary in compression and resizing and
frequency-domain hashing is more tolerant. Verified as the standard comparison
basis (Hamming distance) in MDPI Electronics 2024.

**⚠️ Weights are deliberately not set here.** They MUST come from the FR-10
baseline on a hand-labelled sample. A weight table written before measurement is
a guess wearing a table format.

---

## 7. API Contracts

```ts
export type MatchMethod = 'image_hash' | 'title_norm' | 'category' | 'gtin'
                       | 'network_variant' | 'manual';

export type ConfidenceBand = 'high' | 'medium' | 'low' | 'insufficient';

export interface MatchSignals {
  readonly imageHash?: number;      // 0..1, undefined = not compared
  readonly titleJaccard?: number;   // 0..1
  readonly categoryAgreement?: boolean;
  readonly priceProximity?: number; // 0..1
  readonly familiesFired: number;   // independent families agreeing (FR-12)
}

export interface IdentityCandidate {
  readonly productIdA: string;
  readonly productIdB: string;
  readonly networkA: string;
  readonly networkB: string;
  readonly similarity: number;      // NOT a probability (FR-11)
  readonly band: ConfidenceBand;    // includes 'insufficient' (FR-13)
  readonly method: MatchMethod;
  readonly signals: MatchSignals;   // auditable (FR-9)
  readonly caveats: readonly string[];  // e.g. 'category_unavailable_other_network'
}

export interface MatchOutcome {
  readonly candidate: IdentityCandidate | null;   // null = insufficient evidence
  readonly reason: 'matched' | 'below_threshold'
                | 'insufficient_evidence' | 'blocked_no_candidates';
  readonly comparisonsPerformed: number;          // proves blocking worked (AC-13)
}
```

---

## 8. Data Models

Beyond SPEC-003's `product_identity_match`, this spec needs:

### `image_fingerprint`

| Field | Type | Constraints |
|---|---|---|
| `product_id` | uuid | **PK**, FK → `product` |
| `phash_64` | text | NOT NULL — hex of 64-bit PHash |
| `distinct_image_count` | integer | NOT NULL default 1 — EC-10 |
| `computed_at` | timestamptz | NOT NULL |

⚠️ Computed from image **content**, never the URL (EC-6).

### `title_normalised`

| Field | Type | Constraints |
|---|---|---|
| `product_id` | uuid | **PK**, FK → `product` |
| `language` | text | NOT NULL |
| `normalised` | text | NOT NULL — casefold, strip punctuation, collapse whitespace |
| `tokens` | json | NOT NULL — token array for Jaccard |

### `product_variant_group`

| Field | Type | Constraints |
|---|---|---|
| `group_id` | uuid | **PK** |
| `network_id` | text | NOT NULL — **scoped per network** (FR-4) |
| `source` | text | NOT NULL — `network_native` \| `heuristic` (FR-5 provenance) |
| `variant_axis` | text | NULL — e.g. `size`, `color` |

### `match_evaluation`

Baseline measurement record — required by FR-10.

| Field | Type | Constraints |
|---|---|---|
| `evaluation_id` | uuid | **PK** |
| `run_at` | timestamptz | NOT NULL |
| `sample_size` | integer | NOT NULL |
| `sample_composition` | json | NOT NULL — category/price/source breakdown |
| `recall` | real | NOT NULL |
| `precision` | real | NOT NULL |
| `weights_used` | json | NOT NULL |
| `notes` | text | NULL |

---

## 9. Implementation Order

| Step | Work | Gate |
|---|---|---|
| 1 | Title normalisation + tokenisation (pure functions) | Unit tests incl. multilingual |
| 2 | Perceptual hash from image content | Unit tests incl. known pairs |
| 3 | Blocking function | Test: comparisons < all-pairs (AC-13) |
| 4 | Signal extraction + combination | Unit tests per edge case |
| 5 | **Hand-label 500 pairs → run baseline** | **FR-10 — threshold set from measurement, not before** |
| 6 | Set weights from the baseline | Documented in `match_evaluation` |
| 7 | Incremental matching pass, resumable | AC-14 |
| 8 | Reviewer surface for candidates | AC-9 |

⚠️ **Step 5 precedes step 6 by design.** This is the one place where doing it
the other way round is tempting and wrong.

---

## 10. Out of Scope

| Excluded | Reason |
|---|---|
| **Automatic merging of products** | Prohibited by SPEC-003 FR-6 / D-027. Merging destroys per-network attribution needed for commission reconciliation, and is practically irreversible. |
| **Embedding/vector-DB matching (BERT, MAE, Milvus)** | Solving a 116M-vector problem with 50,000 products. Documented reasoning in §1; revisit at ~10M+ products. |
| **Cross-lingual title matching via translation** | EC-4. Requires translation quality we have not measured. Cross-language matches can instead come from image hash + category. |
| **GTIN as a primary signal** | Rarely present, sometimes faked (FR-8). Never required. |
| **Seller-identity resolution** | EC-13 — cannot be solved with content signals. Explicit known limitation. |
| **A reviewer/admin UI** | Candidates are queryable via API; a UI is a later phase. |
| **Automatic price-history inheritance across a match** | Even at high confidence, inheriting another product's price history would be a factual error. |
| **Training any model** | No labelled dataset exists at start scale. |
| **Reverse image search to find the original** | External dependency, ToS unclear, and slow at scale. |

---

## 11. Open Questions

| # | Question | Blocking? |
|---|---|---|
| Q1 | Does the AliExpress feed return variant grouping natively? | **No** — FR-4 applies where available; heuristic covers the rest |
| Q2 | Is `product_small_image_urls` distinct per product, or a seller-reused set? | Affects EC-10 handling. Check on first live call. |
| Q3 | What is the real precision/recall of PHash on our image population? | **Yes for weights** — resolved by the FR-10 baseline before step 6 |
| Q4 | Do networks share any category taxonomy? | Affects FR-14's usefulness; absence caps confidence (EC-12) |
| Q5 | Is `promotion_link` stable per product or per-request? | SPEC-004/SPEC-005 concern, not this spec |

**UNVERIFIED and deliberately so:** NFR-1/NFR-2 are **targets, not results.**
No precision or recall figure for this codebase exists yet. The FR-10 baseline is
the mechanism that converts them into measurements, and it is why the weight
table in §6 is left blank.

**Deliberately chosen complexity reduction:** a transformer embedding pipeline is
the industry-standard answer to this problem, and it is wrong for our scale. The
simple approach is defensible **because** of the scale arithmetic and the
image-homogeneity property of marketplace photography — and it stays defensible
only if the FR-10 baseline confirms it.
