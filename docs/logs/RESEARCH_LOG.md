# RESEARCH LOG

Append-only. One block per research round: question, tracks, verdict, confidence,
gaps. Never rewrite history — a correction is a new entry.

---

## Round 1 — 2026-10-08 — PARTIAL (agents failed)

**Question:** can an affiliate platform be built on Alibaba / AliExpress / Temu
that delivers real user value?

**Tracks:** R1 AliExpress API · R2 Alibaba B2B · R3 Temu · R4 feeds & data eng ·
R5 networks · R6 traffic · R7 product synthesis · R8 legal.

**Outcome: all 8 agents died.** Provider overload, `free-models-per-min`,
`free-models-per-day-high-balance`, one `ECONNRESET`. **31 raw source captures
survived** (agents write incrementally); **0 synthesis reports were produced.**

| Track | Captures | Report | Verdict |
|---|---|---|---|
| R1 | 1 | ✗ | partial |
| R2 | 11 | ✗ | captures were sufficient — produced the decisive finding |
| R3 | 0 | ✗ | — |
| R4 | 6 | ✗ | captures sufficient |
| R5 | 0 | ✗ | — |
| R6 | 0 | ✗ | — |
| R7 | 8 | ✗ | captures sufficient |
| R8 | 5 | ✗ | partial |

**Root cause:** 8 concurrent agents on a shared free tier, no validation
beforehand, no failover. **This motivated decision D-022** (agent harness with
model ladders + pre-flight doctor) and D-023 (validation by script, not by
inspection).

---

## Round 2 — 2026-10-08 — PARTIAL (quota exhausted, partial recovery)

**Trigger:** round 1 left the entire commercial half of the programme unresearched.

### Attempt A — parallel redispatch (3 agents)

All three recovery agents (R3, R5, R6) failed with
`free-models-per-day-high-balance`.

**Finding worth recording:** the failure was **provider-wide, not per-model.**
Pinning agents to OpenRouter models did not help, because the daily quota is
enforced on the account, above the model-selection layer. **A model ladder does
not protect against an exhausted account quota** — it protects against per-model
overload only. That is a real limit on the failover design and is recorded so it
is not over-trusted.

### Attempt B — orchestrator fallback (direct HTTP)

`websearch` returned `"No search results found"` for **every** query. Direct
`fetch` of known URLs still worked, so the tracks were attempted directly.

| Track | Method | Outcome | Confidence |
|---|---|---|---|
| **R3 Temu** | 2 official URLs | ✅ **ANSWERED (negative)** — no public API; both partner pages are JS shells | 7/10 |
| **R5 Networks** | 7 network/doc URLs | ✅ **PARTIAL** — Amazon PA-API 5 deprecation + Creators API verified; commission data absent | 6/10 |
| **R6 Traffic** | 3 benchmark URLs | ❌ **BLOCKED** — all DNS/cert failures; **no figures invented** | 3/10 |

### Decisive finding this round

**Amazon PA-API 5 is deprecated and now returns `AccessDenied`.** Verified verbatim
from Amazon's own documentation, including the literal error body. Every
pre-2025 Amazon integration tutorial and SDK targets PA-API 5 and now fails **at
runtime, not build time**.

### Second methodological finding

**Existence questions survive tool degradation; quantitative questions do not.**
R03 was answerable because "does an API exist?" is confirmable with a handful of
targeted requests. R06 was not answerable because EPC is inherently a number that
must be measured or sourced — and it could be neither.

### Round-2 exit assessment

| Goal | Status |
|---|---|
| Temu module decision | ✅ **Closed** — no module; curated source or drop |
| Amazon module target | ✅ **Closed** — Creators API, never PA-API 5 |
| Network tiers | ✅ Structural tiers established; commission data still missing |
| Unit economics | ❌ **Blocked — D-020 still in force** |
| Analytics/tracking decision | ❌ Still unspecified (M1) — now confirmed as a *blocker*, not a nicety |

### Carried to round 3

G17–G31 (see the gap tables in the individual reports and wiki pages), plus the
new tooling need: **CJ and Awin API docs are JS-rendered and require a headless
browser** to research at all.

Full detail: `research/reports/r0*.md`, `docs/wiki/INDEX.md`
