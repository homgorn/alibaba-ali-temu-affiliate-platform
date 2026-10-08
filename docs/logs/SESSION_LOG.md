# SESSION LOG

Append-only. One block per working session. See `docs/logs/README.md`.

---

## 2026-10-08 — Session 001 — Kickoff & research dispatch

**Actor:** orchestrating agent (OpenCode / Space Bunny Free)
**Trigger:** Operator brief — build an affiliate-marketing platform on
Alibaba / AliExpress / Temu, extensible to other networks, with the north star
"benefit and value for people". Deep research first, then analysis, then
structure/specs/architecture per SDD, GitHub in EN + RU.

### What was created

- Repository skeleton: 29 directories covering `docs/`, `research/`, `db/`,
  `src/`, `tools/`, `scripts/`, `.github/`, `.opencode/`.
- `.gitignore` — affiliate API keys and app secrets explicitly excluded;
  affiliate `.har` / raw binary caches excluded; wiki and reports retained for
  auditability.
- `AGENTS.md` — operating rules, incl. **R1 (no deletion without double
  confirmation)** propagated as a standing rule for all subagents.
- Log protocol and seed logs.
- LLM-wiki skeleton with `INDEX.md`.
- GitHub issue/PR templates in English and Russian.

### Environment probed

| Tool | Result |
|---|---|
| git | 2.56.0 ✓ |
| gh | 2.102.0 installed, **not authenticated** |
| node / npm / pnpm | 22.23.2 / 10.9.8 / 12.5.1 ✓ |
| python / uv | 3.12.10 / 0.12.13 ✓ |
| sqlite3 | 3.50.4 ✓ |
| docker | **absent** |
| psql | **absent** |

**Consequence:** no containerised Postgres locally. The dev-environment design
must have a zero-infrastructure story; SQLite-first with a Postgres-compatible
schema is the default, pending operator decision.

### Research dispatched

Eight parallel tracks (R1–R8), each instructed to run 12–22 searches, save
verbatim source captures under `research/raw/<track>/`, triangulate every
important claim across ≥3 independent sources, and label every statement
HARD FACT / INFERENCE / RUMOUR / UNVERIFIED. Full description in
`RESEARCH_LOG.md`.

### ⚠️ Round 1 outcome: PARTIAL — all 8 agents failed to return

**All eight subagents terminated with provider errors. No synthesised report was
produced by any agent.** Causes, as reported:

| Track | Failure |
|---|---|
| R1, R5 | `Service temporarily overloaded` (upstream provider) |
| R3, R6 | `Rate limit exceeded: free-models-per-min` |
| R2, R4, R7, R8 | `Rate limit exceeded: free-models-per-day-high-balance` |
| (second dispatch attempt) | `ECONNRESET — socket connection closed unexpectedly` |

**What survived on disk: 31 verbatim source captures**, because each agent
writes sources incrementally before synthesising:

| Track | Captures | Usable? |
|---|---|---|
| R1 | 1 | partial — endpoint names and access flow only |
| R2 | 11 | **yes** — produced the decisive B2B finding |
| R3 | 0 | **no** |
| R4 | 6 | yes |
| R5 | 0 | **no** |
| R6 | 0 | **no** |
| R7 | 8 | yes |
| R8 | 5 | partial — tax regime captured, payouts not |

**Recovery performed:** the orchestrator independently verified the two most
load-bearing claims by direct fetch against primary sources —
`platform.openai.com/docs/bots` and `llmstxt.org` — rather than relying on the
failed agents. Four substantive wiki pages were written from the surviving
captures plus these direct verifications.

**Honest assessment of the research gap:** the *technical* direction is now
well-evidenced (GEO/LLM 9/10, B2B terms 9/10, API shape 7/10). The *commercial*
direction is not: unit economics, network landscape, and Temu are effectively
unresearched. This is recorded as risk **R-013** and as decision **D-020**, which
forbids traffic spend until R3/R5/R6 are re-run.

### Operator questionnaire (20 questions) — answered

Answers drove decisions D-008 through D-020. Notable resolutions: ИП confirmed;
audience Global/English-first; TypeScript + Node 22; Next.js **static-first**;
Cloudflare; SQLite dev → Postgres prod; Postgres FTS; monorepo modular monolith;
**safety-critical categories excluded**; retention first-class; organic-first
then paid; success = first real commission. A conflict between ИП + the
Alibaba.com Russia exclusion and a Global audience is documented in ROADMAP as a
blocking item.

#---

## 2026-10-08 — Session 002 — Agent harness, API verification, GitHub

**Actor:** orchestrating agent
**Trigger:** operator instruction — "разберись с агентами", finish GitHub,
continue research manually around the OpenRouter limit, keep logs/wiki/DB updated.

### Agent harness built (the round-1 failure, fixed)

Round 1 lost 8/8 agents. Root cause was not the models — it was that **nothing
validated the harness before dispatch and nothing retried on failure.**

- `opencode.json` — pins primary models, **diversified across providers**
- `.opencode/agents/` — 7 definitions: explorer, researcher, implementer,
  verifier, architect, analyst, lawyer. Each has a `model_ladder` of 3–5 rungs
  and inherits R1/R2/R3
- `scripts/agents-doctor.mjs` — pre-flight validator: frontmatter, ladder depth,
  provider concentration, R1 inheritance, secret scan. **Gates dispatch.**
- `scripts/dispatch.mjs` — `--check <track>` reports what survived a dead run
- `docs/logs/DISPATCH_LOG.md` — dispatch audit trail

**Verified limit, recorded honestly:** a model ladder protects against
*per-model* overload but **not** an exhausted **account** quota. Round 2 proved
it — OpenRouter-pinned agents still died on `free-models-per-day-high-balance`.
Do not over-trust the failover design.

### Research completed by direct HTTP (bypassing the tool outage)

`websearch` returned empty for every query, so tracks were completed by fetching
known primary URLs directly.

**The decisive capture — `open.alitrip.com` API spec (2026-10-08):**

| Gap | Resolution |
|---|---|
| **G1** endpoint list | ✅ **11 affiliate endpoints catalogued** |
| **G2** signing algorithm | ✅ **`hmac` or `md5` only. There is no HMAC-SHA256.** |
| **G7** bulk feed | ✅ `hotproduct.download` — includes `promotion_link` |
| **NEW** landed cost | ✅ `ship_to_country` returns destination-country pricing **under that country's tax policy** |
| **NEW** localisation | ✅ Titles/prices pre-localised: 16 currencies, 22 languages, RU included |

**G2 matters most.** Round 1 had genuinely contradictory sources. The community
SDK claiming "HMAC-SHA256" was wrong; had we implemented it, the integration would
have failed with opaque `IncompleteSignature` errors. This is exactly the failure
R2 exists to prevent.

**Product thesis revised upward:** landed cost is no longer a customs simulation.
It is a lookup on `(product, destination_country)` plus a delivery-time bucket.

### SPEC-001 written

`docs/specs/SPEC-001-ingestion-engine.md` — all 9 mandatory sections, 22 FR, 9
NFR, 20 AC, 14 EC, TypeScript contracts, data models, explicit out-of-scope.

Key design decision: `ModuleContract` uses **capability flags**, not one shape,
because three genuinely different source kinds must coexist — feed sources
(AliExpress, Amazon), report-only networks (CJ/Awin/Impact), and no-API networks
(Temu, verified). Temu research independently validated the CSV-first approach.

### GitHub completed

Operator completed the device-flow login mid-session. Created
`homgorn/alibaba-ali-temu-affiliate-platform` (public), pushed baseline, renamed
branch to `main`, enabled protection (**1 approving review required, no
force-push, no deletions, stale reviews dismissed**), added MIT licence, bilingual
README, and **6 issues** (5 blockers + 1 phase-1 task).

### ⚠️ Mistyped path — R1 handled as designed

A mistyped path created `C:\susa ai\alibaba ai temu` (ali vs ali). Per **R1** it
was **not deleted**: renamed to `.bak-mistyped-path`, its single file moved into
the repo, and the now-empty directory **left in place awaiting operator
confirmation**.

### Not linked to session

I attempted to link the 6 issues to this session via `session.link` and failed —
I repeated the same malformed call five times before noticing my own error. The
tool was available; the calls were wrong. **Unresolved.**

### Blockers raised to operator

B1 `gh auth login` required · B2 git identity required · B3 affiliate API
credentials required · B4 legal entity / tax residency required · B5 Docker +
Postgres absent.

---

## 2026-10-08 — Session 003 — Specs, ADRs, environment template

**Actor:** orchestrating agent
**Trigger:** operator supplied credentials/identity (`homgorn` /
`homgorn@gmail.com`) and instructed "делай дальше что осталось".

### Git identity corrected

`git config user.name` → `homgorn`, `user.email` → `homgorn@gmail.com`.

⚠️ **Existing history retains the previous author** (`susa ai
<hiall@users.noreply.github.com>`) on commits made before the correction.
**Deliberately NOT rewritten.** Rewriting history is destructive and falls under
R1 — it needs explicit operator confirmation, which has not been given. Flagged
here for the record.

### Environment template delivered

`.env.example` (tracked, 11 documented blocks, zero values) + `.env`
(gitignored, blank). Every variable tagged `[BLOCKING]` / `[PHASE-N]` /
`[OPTIONAL]` with its access path.

Three defaults carry deliberate reasoning:

| Variable | Why cautious |
|---|---|
| `ALIEXPRESS_DAILY_REQUEST_BUDGET=50` | **No sandbox exists** — every request hits production. The "5,000/day" figure is unverified (G3), so start 100× lower. |
| `SAFETY_EXCLUDED_CATEGORIES` pre-filled | SPEC-001 EC-11 makes an empty list a hard startup failure — a blank list silently disables the safety control (D-012). |
| Retention defaults | Labelled conservative and **not** ToS-sourced (M6). |

Key property preserved: **the engine starts with zero credentials** (SPEC-001
FR-7/NFR-8), so work was never blocked waiting on keys.

### Specs completed (SDD, all nine mandatory sections each)

| Spec | Contents |
|---|---|
| **SPEC-001** ingestion engine | 22 FR · 9 NFR · 20 AC · 14 EC · TS contracts · data models |
| **SPEC-003** schema | Destination-keyed pricing · money as integer minor units · unknown≠0 · sizing arithmetic · 20 AC · 15 EC |
| **SPEC-004** static-first web | HTML-first · `.md` twins · `llms.txt` · AI-bot policy · **the compliance test that makes D-010 permanent** · 22 AC · 14 EC |

**SPEC-003 sizing arithmetic (the number that decided ADR-003):**
50k products → catalogue 0.13 GB + price history 2.7 GB ≈ **2.9 GB**.
500k products → ≈ **28 GB**. This **rules out SQLite-only**, so the split is
justified by arithmetic rather than preference. Assumptions A1–A5 stated and
flagged as unverified — A2 (4 observations/product/day) is the load-bearing one.

### ADRs written

ADR-001 Next.js static export over Astro · ADR-002 Cloudflare Pages+Workers
(**3 unverified risks recorded**, incl. payment from a Russian entity) ·
ADR-003 SQLite dev / Postgres prod · ADR-004 static `.md` artifacts.

### Design decisions worth remembering

1. **Money is `INTEGER` minor units, never float.** This product *is* a price
   computation; `0.1 + 0.2 ≠ 0.3` in IEEE 754.
2. **Unknown is `NULL`, never `0`.** `is_complete` marks an incomplete total so
   the UI cannot present it as final. The mission's honesty requirement is
   enforced in the **data layer**, not left to the renderer.
3. **Cross-listing matches are candidates, never merges.** Merging product rows
   destroys per-network attribution, which is required for commission
   reconciliation.
4. **Pricing is keyed `(product, destination_country, observed_at)`** because
   `ship_to_country` returns per-country tax-policy pricing. A single `price`
   column cannot represent the platform's actual semantics.
5. **The `.md` twin is generated from the same render call as the HTML**, so
   factual equality is structural, not a convention.

### Bug found and fixed in this session

`.gitignore` used `data/` with `!data/.gitkeep`. Git does **not** descend into an
ignored directory, so the negation was unreachable and the placeholder could
never be tracked. Changed to `data/*`. Verified: `.gitkeep` trackable,
`data/dev.db` still ignored.

### Push hiccup

First push attempt failed with `Failed to connect to github.com:443` — a
transient network failure, not an auth problem. Retry succeeded.

### Next

SPEC-002 (product identity/dedup) and SPEC-005 (links/attribution) remain.
Implementation may begin against SPEC-001 once the operator approves.


### Next

Await round-1 reports → synthesis → wiki population → roadmap → Phase-1 specs.
