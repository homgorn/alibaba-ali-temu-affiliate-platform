# ADR-003 — Database: SQLite dev, Postgres prod

| Field | Value |
|---|---|
| **Status** | Accepted (supersedes the provisional D-005) |
| **Date** | 2026-10-08 |
| **Deciders** | operator · orchestrating agent |
| **Relates to** | D-005, D-011, SPEC-003 |

## Context

The dev machine has **no Docker and no `psql`**. It does have `sqlite3` 3.50.4.
A design that cannot start locally cannot be verified locally, and unverifiable
work silently degrades into guesswork.

The sizing arithmetic in SPEC-003 §2 projects **≈ 2.9 GB at start scale (50k
products)** and **≈ 28 GB at 500k products** — derived from verified API field
semantics and stated assumptions A1–A5.

## Decision

**SQLite in development, Postgres in production, one schema.**

The schema MUST contain no unportable feature outside explicitly marked,
optional sections (SPEC-003 FR-1/FR-2). Migration files are shared.

## Alternatives considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **SQLite dev + Postgres prod** | Dev works today with zero install; one schema, one set of migrations; Postgres-compatible types are well understood; the size at start scale is comfortable | Two engines to test against (mitigated by AC-2); SQLite has no concurrent-write story | ✅ **Chosen** |
| **Install Docker, Postgres everywhere** | One engine; no dialect drift | Requires the operator to install Docker Desktop and restart; not currently available | ❌ Not now — revisit if the operator wants it |
| **SQLite forever** | Simplest possible ops | **Fails at ~28 GB** per the sizing math; no concurrent writes for a continuous ingestion worker | ❌ Ruled out by arithmetic |
| **Managed Postgres from day one** | No local install; prod-like from the start | Adds an account, network dependency and cost; still cannot run offline | ❌ |

## Consequences

**Positive**
- Development and verification start immediately, with no infrastructure work.
- The sizing math explicitly rules out SQLite-only, so the constraint has a
  documented basis rather than a preference.

**Negative**
- Two engines must be tested (SPEC-003 AC-2 requires migrations to pass on both).
- SQLite lacks `TIMESTAMPTZ`, `JSONB`, `BOOLEAN` and native FTS. The type mapping
  in SPEC-003 §6 handles this with text/integer storage, at the cost of losing
  native JSON operators in SQLite.
- **FTS differs materially between engines.** PostgreSQL uses `tsvector` +
  GIN; SQLite uses FTS5 with different ranking and tokenizer behaviour. The spec
  isolates full-text into an **optional migration** (FR-21) so a missing or
  divergent FTS index cannot block a working install. ⚠️ Search results will
  therefore differ between dev and prod — acceptable at start scale, and a known
  trade-off rather than a surprise.

## Revisit when

- The operator installs Docker → consider collapsing to Postgres everywhere.
- Projected storage exceeds ~500 GB → revisit partitioning (currently out of
  scope).
- Search requirements outgrow FTS → evaluate Meilisearch/Typesense (gap G23).

## ⚠️ Note

The sizing figures depend on **assumptions**, not measurements. A2 (4
observations/product/day) is the most load-bearing: if it is wrong by an order of
magnitude, price history dominates and downsampling becomes mandatory. The
retention policy (SPEC-003 FR-15–18) is built to absorb that.
