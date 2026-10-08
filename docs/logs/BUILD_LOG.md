# BUILD LOG

Append-only. One entry per verified feature: verdict, evidence, and what the
verification actually caught. See `docs/logs/README.md`.

The point of this file is not to record that things passed. It is to record
**what the verification found**, because in both cases below the code looked
correct on the page and was wrong in execution.

---

## F011 — SQLite migrations from a fresh checkout

**Verified:** 2026-10-08 · **Verifier:** orchestrating agent (self-verification)
**Verdict:** VERIFIED (11/11) · `passes: true`

| Check | Result | Evidence |
|---|---|---|
| AC-1 migrations on an empty DB < 10 s (NFR-4) | PASS | 79 ms |
| F011 step 2 command completes without error | PASS | exit 0 |
| F011 step 3 every SPEC-003 §6 table exists | PASS | 24 tables, 0 missing |
| F011 step 3 product + price-history tables | PASS | product, price_observation, price_daily_rollup |
| FR-3 every money column INTEGER | PASS | 11 columns, 0 float |
| AC-3 / NFR-5 re-running applies nothing | PASS | 1 row before, 1 after |
| Drift detection refuses edits to applied migrations | PASS | refused with checksum diff |
| Referential integrity | PASS | 0 FK violations |
| Negative-test proof (cannot pass vacuously) | PASS | asserts checked > 5 |
| Test suite | PASS | 42/42 |
| Typecheck | PASS | exit 0 |

**What verification caught:** the runner lacked `close()`, so SQLite in WAL mode
held a file lock and Windows could not delete the test databases (EBUSY). Only
visible by running.

**INCONCLUSIVE, explicitly not claimed as passing:** SPEC-003 AC-2 — the same
migrations applying to Postgres. No Postgres server on this machine (no Docker,
no `psql`). ADR-003 records it as an open gap.

---

## F012 — CSV feed ingested end to end

**Verified:** 2026-10-08 · **Verifier:** orchestrating agent (self-verification)
**Verdict:** VERIFIED (15/15) · `passes: true`

| Check | Result | Evidence |
|---|---|---|
| F012 step 2 documented command completes | PASS | exit 0 |
| F012 step 2 prints a rows-ingested count | PASS | `rows read 66` |
| F012 step 3 rows read == fixture row count | PASS | 66 == 66 |
| F012 step 3 every row stored or safety-excluded | PASS | 56 + 10 = 66 |
| F012 step 3 product + price-history populated | PASS | 56 products, 56 observations |
| F012 step 4 second run applies nothing | PASS | products 56→56, obs 56→56 |
| F012 step 4 second run still audits itself | PASS | ingestion_run 1 → 2 |
| F012 step 4 reports 0 written / N unchanged | PASS | 0 / 56 |
| F012 step 5 one changed field updates one row | PASS | 1 written; no new price point |
| SPEC-003 FR-9 unknown stays NULL, never 0 | PASS | 7 incomplete, 49 complete, 0 stored-as-0 |
| SPEC-001 FR-20 no excluded product in catalogue | PASS | 0 found |
| SPEC-003 FR-3 money still integer-only after ingest | PASS | 0 violations |
| SPEC-003 FR-19 every product traceable to a run | PASS | 0 orphans |
| Test suite | PASS | 102/102 |
| Typecheck | PASS | exit 0 |

### What verification caught

Four real bugs, none of which were visible from reading the code:

1. **Price observations doubled on re-ingest.** The natural key
   `(product, destination, observed_at)` includes the timestamp, so replaying
   the same feed at a new instant appended a new point — 56 → 112. Products were
   stable, which is why a cheaper check would have passed. *Fix:* the CLI derives
   `observedAt` from the file's mtime, so an unchanged file replays as unchanged
   and only a genuinely later reading extends the history.

2. **SQLite placeholder binding was wrong.** `?` binds positionally, so a
   repeated `$10` consumed two parameters and shifted every later binding.
   *Fix:* the numbered `?NNN` form, which is the exact equivalent of Postgres
   `$10`. A unit test now pins the repeated-placeholder case.

3. **The safety control was half-working.** `Batteries` did not match the
   keyword `battery` (the stems differ), so real batteries passed the gate.
   *Fix:* tokenise + light stemming + consecutive-run matching. This also stopped
   `Batteryless Flashlight` from being excluded.

4. **A string was spread instead of wrapped.** `[...text]` yields *characters*,
   so title matching never fired while category matching still worked. A control
   that works on one path and silently fails on the other survives review
   indefinitely — this is the most dangerous class of bug found so far.

**Method note:** assertions run through a **separate database connection** and
the documented CLI, never through the code path under test. A self-check sharing
code with the thing it checks proves nothing — the first version of the F011
verifier made exactly that mistake and reported drift detection as failing when
the verifier, not the code, was at fault.

---

## F013 — price history across multiple ingests

**Status:** not yet verified. See `feature_list.json`.
