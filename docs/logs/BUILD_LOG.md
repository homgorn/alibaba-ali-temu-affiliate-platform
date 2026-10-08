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
