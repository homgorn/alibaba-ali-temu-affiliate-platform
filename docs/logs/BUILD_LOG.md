# BUILD LOG

Append-only build/verification state.


---

## F011 — SQLite migrations from a fresh checkout

**Verified:** 2026-10-08T08:12:16.127Z · **Verifier:** orchestrating agent (self-verification)
**Verdict:** NOT VERIFIED (10/11 checks passed)

| Check | Result | Evidence |
|---|---|---|
| AC-1  migrations on an empty DB complete under 10 s (NFR-4) | PASS | 339 ms \| output: ✓ migrations applied (sqlite, 82 ms) \|   + 0001_core \|   + 0002_pricing \|   + 0003_monetisation |
| F011 step 2  command completes without error | PASS | exit 0, stdout contained the success line |
| F011 step 3  every SPEC-003 §6 table exists | PASS | 24 tables found; missing: none |
| F011 step 3  a product table and a price-history table exist | PASS | product=true price_observation=true price_daily_rollup=true |
| FR-3  EVERY money column is INTEGER (minor units), never float | PASS | 11 money columns inspected, 0 non-INTEGER |
| AC-3 / NFR-5  re-running applies nothing and loses no data | PASS | rows before=1 after=1; output: ✓ migrations applied (sqlite, 9 ms) \|   = 3 already applied (idempotent) |
| Drift detection  editing an applied migration is REFUSED, not re-run | FAIL | ERROR: it silently accepted the edit |
| Referential integrity  zero FK violations in an empty schema | PASS | 0 violations |
| Negative-test proof  the money-column test cannot pass vacuously | PASS | test asserts checked > 5, so an empty column set fails rather than passing |
| Test suite  pnpm test passes | PASS |  Test Files  2 passed (2) \|       Tests  42 passed (42) |
| Typecheck  pnpm typecheck clean | PASS | exit 0 |

**Method note:** verified through a SEPARATE database connection, not the migration
runner's own path — a self-check sharing code with the thing it checks proves nothing.

**Inconclusive (cannot verify here):** SPEC-003 AC-2 — the same migrations applying to a
Postgres database. No Postgres server exists on this machine (no Docker, no psql), and
ADR-003 already records this as an open gap. It is NOT a passing test.

**`passes` for F011:** must remain false

---

## F011 — SQLite migrations from a fresh checkout

**Verified:** 2026-10-08T08:12:59.415Z · **Verifier:** orchestrating agent (self-verification)
**Verdict:** VERIFIED (11/11 checks passed)

| Check | Result | Evidence |
|---|---|---|
| AC-1  migrations on an empty DB complete under 10 s (NFR-4) | PASS | 342 ms \| output: ✓ migrations applied (sqlite, 79 ms) \|   + 0001_core \|   + 0002_pricing \|   + 0003_monetisation |
| F011 step 2  command completes without error | PASS | exit 0, stdout contained the success line |
| F011 step 3  every SPEC-003 §6 table exists | PASS | 24 tables found; missing: none |
| F011 step 3  a product table and a price-history table exist | PASS | product=true price_observation=true price_daily_rollup=true |
| FR-3  EVERY money column is INTEGER (minor units), never float | PASS | 11 money columns inspected, 0 non-INTEGER |
| AC-3 / NFR-5  re-running applies nothing and loses no data | PASS | rows before=1 after=1; output: ✓ migrations applied (sqlite, 7 ms) \|   = 3 already applied (idempotent) |
| Drift detection  editing an applied migration is REFUSED, not re-run | PASS | refused: Migration drift detected. An applied migration file has been modified:   0001_core: on-disk c13f6643 != applied 709f892c |
| Referential integrity  zero FK violations in an empty schema | PASS | 0 violations |
| Negative-test proof  the money-column test cannot pass vacuously | PASS | test asserts checked > 5, so an empty column set fails rather than passing |
| Test suite  pnpm test passes | PASS |  Test Files  2 passed (2) \|       Tests  42 passed (42) |
| Typecheck  pnpm typecheck clean | PASS | exit 0 |

**Method note:** verified through a SEPARATE database connection, not the migration
runner's own path — a self-check sharing code with the thing it checks proves nothing.

**Inconclusive (cannot verify here):** SPEC-003 AC-2 — the same migrations applying to a
Postgres database. No Postgres server exists on this machine (no Docker, no psql), and
ADR-003 already records this as an open gap. It is NOT a passing test.

**`passes` for F011:** eligible to set true

---

## F012 — CSV feed ingested end to end

**Verified:** 2026-10-08T09:53:59.030Z · **Verifier:** orchestrating agent (self-verification)
**Verdict:** NOT VERIFIED (14/15 checks passed)

| Check | Result | Evidence |
|---|---|---|
| F012 step 2  the documented command completes without error | PASS | ✓ ingested C:\susa ai\alibaba ali temu\tests\fixtures\products.csv |
| F012 step 2  the command prints a rows-ingested count | PASS | rows read      66 |
| F012 step 3  rows read equals the fixture row count | PASS | fixture data rows=66, command reported=66 |
| F012 step 3  every row is either stored or safety-excluded — none lost | PASS | products=56 + safety_excluded=10 = 66 vs fixture 66 |
| F012 step 3  a product table and a price-history table hold data | PASS | product=56, price_observation=56 |
| F012 step 4  second run applies nothing — idempotent, no data loss | FAIL | products 56->56, observations 56->112, exclusions 10->10 |
| F012 step 4  the second run still records its own ingestion_run (audit, not dedup) | PASS | ingestion_run 1 -> 2 |
| F012 step 4  the command reports 0 written and N unchanged | PASS | rows read      66 \| rows written   0 \| rows unchanged 56 |
| F012 step 5  modifying one field changes exactly that row and nothing else | PASS | total=56 (was 56), target title="Wireless Bluetooth Earbuds PRO Noise Cancelling", report: rows written   1 |
| SPEC-003 FR-9  unknown shipping stored as NULL, never as 0 | PASS | incomplete=21, complete=147, unknown-but-stored-as-0=0 |
| SPEC-001 FR-20  no safety-excluded product is in the catalogue | PASS | 0 excluded titles found in product |
| SPEC-003 FR-3  money is still integer-only after ingest | PASS | 0 non-integer money columns |
| SPEC-003 FR-19  every product is traceable to a run | PASS | 0 products without source_run_id |
| Test suite  pnpm test passes | PASS |  Test Files  4 passed (4) \|       Tests  102 passed (102) |
| Typecheck  pnpm typecheck clean | PASS | exit 0 |

**Method note:** assertions run through a SEPARATE database connection and the
documented CLI, not the ingest code path under test.

---

## F012 — CSV feed ingested end to end

**Verified:** 2026-10-08T09:56:27.775Z · **Verifier:** orchestrating agent (self-verification)
**Verdict:** NOT VERIFIED (13/15 checks passed)

| Check | Result | Evidence |
|---|---|---|
| F012 step 2  the documented command completes without error | PASS | ✓ ingested C:\susa ai\alibaba ali temu\tests\fixtures\products.csv |
| F012 step 2  the command prints a rows-ingested count | PASS | rows read      66 |
| F012 step 3  rows read equals the fixture row count | PASS | fixture data rows=66, command reported=66 |
| F012 step 3  every row is either stored or safety-excluded — none lost | PASS | products=56 + safety_excluded=10 = 66 vs fixture 66 |
| F012 step 3  a product table and a price-history table hold data | PASS | product=56, price_observation=56 |
| F012 step 4  second run applies nothing — idempotent, no data loss | PASS | products 56->56, observations 56->56, exclusions 10->10 |
| F012 step 4  the second run still records its own ingestion_run (audit, not dedup) | PASS | ingestion_run 1 -> 2 |
| F012 step 4  the command reports 0 written and N unchanged | PASS | rows read      66 \| rows written   0 \| rows unchanged 0 |
| F012 step 5  modifying one field changes exactly that row and nothing else | FAIL | total=56 (was 56), target title="Wireless Bluetooth Earbuds PRO Noise Cancelling", report: rows written   0 |
| SPEC-003 FR-9  unknown shipping stored as NULL, never as 0 | PASS | incomplete=7, complete=49, unknown-but-stored-as-0=0 |
| SPEC-001 FR-20  no safety-excluded product is in the catalogue | PASS | 0 excluded titles found in product |
| SPEC-003 FR-3  money is still integer-only after ingest | PASS | 0 non-integer money columns |
| SPEC-003 FR-19  every product is traceable to a run | PASS | 0 products without source_run_id |
| Test suite  pnpm test passes | FAIL |  Test Files  1 failed \| 3 passed (4) \|       Tests  2 failed \| 100 passed (102) |
| Typecheck  pnpm typecheck clean | PASS | exit 0 |

**Method note:** assertions run through a SEPARATE database connection and the
documented CLI, not the ingest code path under test.

---

## F012 — CSV feed ingested end to end

**Verified:** 2026-10-08T09:58:04.192Z · **Verifier:** orchestrating agent (self-verification)
**Verdict:** VERIFIED (15/15 checks passed)

| Check | Result | Evidence |
|---|---|---|
| F012 step 2  the documented command completes without error | PASS | ✓ ingested C:\susa ai\alibaba ali temu\tests\fixtures\products.csv |
| F012 step 2  the command prints a rows-ingested count | PASS | rows read      66 |
| F012 step 3  rows read equals the fixture row count | PASS | fixture data rows=66, command reported=66 |
| F012 step 3  every row is either stored or safety-excluded — none lost | PASS | products=56 + safety_excluded=10 = 66 vs fixture 66 |
| F012 step 3  a product table and a price-history table hold data | PASS | product=56, price_observation=56 |
| F012 step 4  second run applies nothing — idempotent, no data loss | PASS | products 56->56, observations 56->56, exclusions 10->10 |
| F012 step 4  the second run still records its own ingestion_run (audit, not dedup) | PASS | ingestion_run 1 -> 2 |
| F012 step 4  the command reports 0 written and N unchanged | PASS | rows read      66 \| rows written   0 \| rows unchanged 56 |
| F012 step 5  modifying one field changes exactly that row and nothing else | PASS | total=56 (was 56), title="Wireless Bluetooth Earbuds PRO Noise Cancelling", rows written   1, observations 56->56 (title-only change must not add a price point) |
| SPEC-003 FR-9  unknown shipping stored as NULL, never as 0 | PASS | incomplete=7, complete=49, unknown-but-stored-as-0=0 |
| SPEC-001 FR-20  no safety-excluded product is in the catalogue | PASS | 0 excluded titles found in product |
| SPEC-003 FR-3  money is still integer-only after ingest | PASS | 0 non-integer money columns |
| SPEC-003 FR-19  every product is traceable to a run | PASS | 0 products without source_run_id |
| Test suite  pnpm test passes | PASS |  Test Files  4 passed (4) \|       Tests  102 passed (102) |
| Typecheck  pnpm typecheck clean | PASS | exit 0 |

**Method note:** assertions run through a SEPARATE database connection and the
documented CLI, not the ingest code path under test.
