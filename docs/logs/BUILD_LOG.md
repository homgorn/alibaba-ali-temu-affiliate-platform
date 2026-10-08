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

**Verified:** 2026-10-08 · **Verifier:** orchestrating agent (self-verification)
**Verdict:** VERIFIED (10/10) · `passes: true`

| Check | Result | Evidence |
|---|---|---|
| F013 step 1-2 >1 historical price point after multiple ingests | PASS | 18.50 → 14.99 |
| The price drop is recorded as a distinct earlier value | PASS | first=18.50, second=14.99 |
| F013 step 2 each observation records its source | PASS | `csv` |
| F013 step 3 / FR-18 rollup survives raw deletion | PASS | 1 → 1 rows after `DELETE` |
| F013 step 3 retention rule has a rollup target | PASS | `price_daily_rollup`, 365 days |
| A price-only change reports rowsWritten 1 | PASS | was reporting 0 |
| A no-op re-ingest reports rowsWritten 0 | PASS | |
| Unchanged feed on 3 later dates adds no duplicate | PASS | 1 observation |
| Test suite | PASS | 113/113 |
| Typecheck | PASS | exit 0 |

### What verification caught

Three bugs, all in code that looked correct:

1. **A price change was recorded but reported as `0 rows written`.** The
   idempotency fingerprint compared the product row *after* the upsert against a
   snapshot taken *after* as well, so the two always matched. Every run claimed
   to be a no-op — including runs that genuinely dropped a price. The database
   was right; the *report* was a lie, which is worse, because it would have made
   a broken sync look healthy.

2. **A price-only change counted as unchanged.** `written` only considered
   title/url/image. A feed that moved one price — the most common real-world
   event — reported nothing changed while the price series grew.

3. **`rollup_to` stored the literal string `"rollup_to"`.** The seed encoded the
   target as `"rollup_to=price_daily_rollup"` and then split on `=`, taking the
   wrong side. So the retention policy pointed at a non-existent table. The
   verifier caught it only because it asserted the *value*, not the presence of
   the field.

**Method note:** the duplicate-check ran in a second scratch database rather than
reusing the first, because the first had its raw observations deliberately
deleted to test the rollup. Verifying with contaminated state is how a real
regression hides.

### Not implemented

The retention **job** (FR-16/FR-17) — batched, resumable deletion — is not
written yet. Only the configuration, the rollup target, and the schema are. This
is recorded as a known gap on the feature rather than claimed as done.


---

## F013 — price history across multiple ingests

**Verified:** 2026-10-08T10:06:00.480Z · **Verifier:** orchestrating agent (self-verification)
**Verdict:** NOT VERIFIED (9/10 checks passed)

| Check | Result | Evidence |
|---|---|---|
| F013 step 1-2  a product queried after multiple ingests returns >1 historical price point | PASS | 2 points for 33006951783: 2026-10-01=18.50 -> 2026-10-05=14.99 |
| F013  the price DROP is recorded as a distinct earlier value | PASS | first=18.50, second=14.99 |
| F013 step 2  each observation records its source | PASS | sources: csv |
| F013 step 3 / FR-18  the daily rollup survives deletion of raw observations | PASS | rollup rows 1 -> 1 after deleting all raw observations |
| F013 step 3  retention/downsample rule is configured with a rollup target | FAIL | {"table_name":"price_observation","max_age_days":365,"rollup_to":"rollup_to"} |
| A price-only change is reported as rowsWritten 1, not 0 | PASS | rows written   1 |
| A no-op re-ingest is reported as rowsWritten 0 | PASS | rows written   0 |
| Re-ingesting an unchanged feed on 3 later dates adds NO duplicate price point | PASS | 33006951783 has 1 observation(s) after 3 ingests at T1/T2/T3 with an unchanged price |
| Test suite  pnpm test passes | PASS |  Test Files  5 passed (5) \|       Tests  113 passed (113) |
| Typecheck  pnpm typecheck clean | PASS | exit 0 |

---

## F013 — price history across multiple ingests

**Verified:** 2026-10-08T10:06:39.402Z · **Verifier:** orchestrating agent (self-verification)
**Verdict:** VERIFIED (10/10 checks passed)

| Check | Result | Evidence |
|---|---|---|
| F013 step 1-2  a product queried after multiple ingests returns >1 historical price point | PASS | 2 points for 33006951783: 2026-10-01=18.50 -> 2026-10-05=14.99 |
| F013  the price DROP is recorded as a distinct earlier value | PASS | first=18.50, second=14.99 |
| F013 step 2  each observation records its source | PASS | sources: csv |
| F013 step 3 / FR-18  the daily rollup survives deletion of raw observations | PASS | rollup rows 1 -> 1 after deleting all raw observations |
| F013 step 3  retention/downsample rule is configured with a rollup target | PASS | {"table_name":"price_observation","max_age_days":365,"rollup_to":"price_daily_rollup"} |
| A price-only change is reported as rowsWritten 1, not 0 | PASS | rows written   1 |
| A no-op re-ingest is reported as rowsWritten 0 | PASS | rows written   0 |
| Re-ingesting an unchanged feed on 3 later dates adds NO duplicate price point | PASS | 33006951783 has 1 observation(s) after 3 ingests at T1/T2/T3 with an unchanged price |
| Test suite  pnpm test passes | PASS |  Test Files  5 passed (5) \|       Tests  113 passed (113) |
| Typecheck  pnpm typecheck clean | PASS | exit 0 |

---

## F013 — price history across multiple ingests

**Verified:** 2026-10-08T11:44:12.112Z · **Verifier:** orchestrating agent (self-verification)
**Verdict:** VERIFIED (10/10 checks passed)

| Check | Result | Evidence |
|---|---|---|
| F013 step 1-2  a product queried after multiple ingests returns >1 historical price point | PASS | 2 points for 33006951783: 2026-10-01=18.50 -> 2026-10-05=14.99 |
| F013  the price DROP is recorded as a distinct earlier value | PASS | first=18.50, second=14.99 |
| F013 step 2  each observation records its source | PASS | sources: csv |
| F013 step 3 / FR-18  the daily rollup survives deletion of raw observations | PASS | rollup rows 1 -> 1 after deleting all raw observations |
| F013 step 3  retention/downsample rule is configured with a rollup target | PASS | {"table_name":"price_observation","max_age_days":365,"rollup_to":"price_daily_rollup"} |
| A price-only change is reported as rowsWritten 1, not 0 | PASS | rows written   1 |
| A no-op re-ingest is reported as rowsWritten 0 | PASS | rows written   0 |
| Re-ingesting an unchanged feed on 3 later dates adds NO duplicate price point | PASS | 33006951783 has 1 observation(s) after 3 ingests at T1/T2/T3 with an unchanged price |
| Test suite  pnpm test passes | PASS |  Test Files  5 passed (5) \|       Tests  113 passed (113) |
| Typecheck  pnpm typecheck clean | PASS | exit 0 |
