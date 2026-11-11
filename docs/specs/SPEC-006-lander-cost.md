# SPEC-006 — Landed-Cost Computation

**ID:** SPEC-006
**Status:** Approved
**Author:** orchestrating agent
**Date:** 2026-11-05
**Reviewers:** operator (pending) · architect agent (pending)
**Supersedes:** —

## 1. Context

SPEC-001 stores `sale_price_minor`, `shipping_minor` and `duty_minor` keyed by
`(product, destination_country, observed_at)` (D-028). SPEC-005 §2.6 demands
that a page visibly state which cost components are NOT included in any
displayed total, and that an incomplete total is never presented as final.

The mission's core promise is an **honest landed cost** — item + shipping +
duty + VAT + handling — and the most common failure mode is presenting a
partial sum as complete. This spec defines the computation, the honesty
contract and the rendering rules that make that impossible.

## 2. Functional Requirements

- **FR-1** Landed cost is the sum of: item price + shipping + duty + VAT +
  handling. Each component MUST be stored or computed independently, never
  folded into a single "total" column.
- **FR-2** Every component MUST carry an explicit **known/unknown** flag.
  `NULL` means unknown; `0` is a real value (e.g. free shipping) only when
  the feed explicitly states it. Inheriting `0` from a missing component is
  prohibited (SPEC-003 FR-9).
- **FR-3** A total MUST be computed **only when every component is known**.
  If any component is unknown, `total_minor = NULL` and `is_complete = false`.
  No partial total is ever surfaced as final.
- **FR-4** Duty rates MUST come from a **per-destination, per-category
  tariff table** (operator-sourced, not fabricated). If the rate is not in
  the table, duty is unknown — never estimated.
- **FR-5** VAT rates MUST come from a **per-destination rate table**
  (operator-sourced). If the rate is not in the table, VAT is unknown.
- **FR-6** Handling / broker fees MUST come from the feed or from an
  operator-configured per-destination fee. If neither exists, unknown.
- **FR-7** Shipping MUST come from the feed (`shipping_minor`). If the feed
  does not provide it, unknown — never estimated from weight or distance.
- **FR-8** The page MUST visibly list which components are **included** in the
  displayed total and which are **excluded** or **unknown**.
- **FR-9** Where a value is unknown, the page MUST say so in text. Inventing
  a value to make the page look complete is prohibited (SPEC-004 FR-23).
- **FR-10** Currency conversion, if performed, MUST be explicit: the rate
  used MUST be shown, and the conversion MUST be flagged as an estimate.
- **FR-11** The computation MUST be pure and stateless — given the same
  inputs it always produces the same output. No I/O, no hidden lookups.
- **FR-12** The computation MUST be testable without a database. It takes
  the cost components as inputs and returns a structured result.

## 3. Non-Functional Requirements

- **NFR-1** Computation MUST complete in < 1 ms (pure arithmetic).
- **NFR-2** The function MUST be side-effect free and deterministic.
- **NFR-3** Unknown components MUST be represented as `null` in the result,
  never as `0` or as a string like "N/A" — the rendering layer decides
  presentation.

## 4. Acceptance Criteria

- **AC-1** *(FR-1, FR-3)* Given an observation with item, shipping and duty
  all known, when the total is computed, then `total_minor = item + shipping + duty`.
- **AC-2** *(FR-1, FR-3)* Given an observation where shipping is NULL, when
  the total is computed, then `total_minor = NULL` and `is_complete = false`.
- **AC-3** *(FR-2)* Given a total with one unknown component, when rendered,
  then the page shows the known components and explicitly states the unknown.
- **AC-4** *(FR-4, FR-5)* Given a destination with no duty/VAT rate in the
  table, when the total is computed, then duty/VAT is unknown, not estimated.
- **AC-5** *(FR-8)* Given any rendered total, when inspected, then the page
  visibly lists which components are included and which are excluded/unknown.
- **AC-6** *(FR-11, FR-12)* Given the same inputs, when computed twice,
  then the results are identical (deterministic).
- **AC-7** *(NFR-1)* Given the computation, when measured, then it completes
  in < 1 ms.

## 5. Edge Cases

- **EC-1** All components unknown (new product, no feed data) → total NULL,
  completeness false, page says "cost data not yet available".
- **EC-2** Shipping is 0 (feed says free shipping) → treated as known 0, NOT
  unknown. The distinction matters: 0 is a value, NULL is unknown.
- **EC-3** Duty rate table has no entry for (country, category) → duty
  unknown. Never default to 0%.
- **EC-4** VAT rate table has no entry for country → VAT unknown.
- **EC-5** Currency mismatch (item in USD, shipping in EUR) → total NULL,
  components shown separately with their currencies. Never convert silently.
- **EC-6** Item price is 0 (free item) → treated as known 0.
- **EC-7** Negative shipping or duty → rejected, not stored. Amounts must be
  >= 0.

## 6. API Contracts

```ts
export interface LandedCostComponent {
  readonly minor: number | null   // minor units, or null if unknown
  readonly currency: string       // ISO-4217
  readonly known: boolean
  readonly source: string        // 'feed', 'tariff-table', 'operator-config', 'unknown'
}

export interface LandedCostResult {
  readonly item: LandedCostComponent
  readonly shipping: LandedCostComponent
  readonly duty: LandedCostComponent
  readonly vat: LandedCostComponent
  readonly handling: LandedCostComponent
  readonly totalMinor: number | null   // null = incomplete
  readonly isComplete: boolean
  readonly included: readonly string[] // component names that are known
  readonly unknown: readonly string[]  // component names that are unknown
  readonly currency: string             // the currency all components share, or 'MIXED'
}
```

## 7. Data Models

No new tables. The computation reads from `price_observation` (item, shipping,
duty, delivery_bucket_days) and from operator-configured rate tables (duty
rate per country+category, VAT rate per country). Rate tables are out of scope
for this spec — they are operator data, not code.

## 8. Out of Scope

- **Duty/VAT rate tables** — operator-sourced data, not code. SPEC-006 defines
  the computation; the rates live in config or DB tables populated by the
  operator.
- **Currency conversion** — if performed, the rate must be explicit and
  flagged as an estimate. Full multi-currency is M7.
- **Handling/broker fees** — operator-configured, not computed.
- **Real-time duty calculation** — not needed; rates change quarterly at most.
- **Shipping estimation** — shipping comes from the feed only (FR-7). Never
  estimated.

## 9. Open Questions

- **Q1** Should duty/VAT rates live in DB tables or config files? (DB is
  more flexible; config is simpler. Decision pending operator.)
- **Q2** What is the operator's actual duty/VAT source? (WTO tariff database?
  Country-specific? Needs R8 legal review.)