# ROADMAP

**Last updated:** 2026-10-08
**Owner:** operator (ИП, Global/English-first audience, TypeScript/Node 22, Next.js + static HTML)
**North star:** *First real commission received.* Everything is subordinate to that.

---

## Confirmed stack (from operator questionnaire)

| Area | Decision | Notes |
|---|---|---|
| Language | TypeScript, Node 22, pnpm | |
| Front-end | Next.js **with 100% static HTML** | no JS-dependent content — see [LLM-DISCOVERABILITY](../wiki/50-strategy-traffic/LLM-DISCOVERABILITY.md) |
| Content mirroring | Every page gets an `.md` twin | llms.txt v2 spec |
| Distribution | Cloudflare (Pages/Workers) | primary; options assessed below |
| DB | SQLite dev → Postgres prod, compatible schema | no Docker on operator machine |
| Search | Postgres FTS first | |
| Shape | Monorepo, modular monolith, one deployable | |
| Legal entity | **ИП** | affects payouts, tax, geo eligibility |
| Audience | **Global / English-first** | ⚠️ see [Conflict](#critical-conflict-ип--russia-vs-global-audience) |
| Revenue goal | Primary income | demands real scale, not a side project |
| Traffic budget | Both organic and paid, phased | organic first, ads once EPC proven |
| Safety-critical goods | **Excluded entirely** | operator decision |
| Data retention | First-class architectural constraint | operator decision |
| Success measure | First real commission | |

---

## ⚠️ CRITICAL CONFLICT: ИП + Russia vs Global audience

Two answers combine into a problem that must be resolved before Phase 1.

**The facts:**
- Operator is an **ИП** (Russian individual entrepreneur).
- Target audience is **Global / English-first**.
- **Alibaba.com B2B explicitly refuses Russian traffic**: *"NOT accept traffic from ... Russia ... and orders from these countries are not ... for commissions."*

**Implications:**

1. **B2B with a Russian-registered ИП is a question, not an answer.** It may be allowed (a Russian entity promoting to US/EU traffic) or may not. Unverified. This is the single highest-value email to send.
2. **AliExpress is probably unaffected** — the Russia exclusion was found on the **Alibaba.com B2B** programme specifically. The AliExpress `ru-api.aliexpress.com` host suggests Russian market access exists there. But per-programme policy is unconfirmed. **Do not assume the two share a geo policy.**
3. **Payout mechanics from a Russian ИП to a foreign network are the real gate.** If money cannot reach the ИП, nothing else matters. This is **R-002** and it is unresolved.

**Required action before Phase 1:** confirm (a) ИП eligibility per programme, (b) geo policy per programme, (c) a working payout path. All three in writing.

---

## Phase 0 — FOUNDATION *(current)*

**Goal:** a legible, verifiable base that no later session has to re-derive.

- [x] Repo skeleton, `AGENTS.md` with R1–R4, `.gitignore` with secret protection
- [x] Log protocol + `DECISION_LOG` (D-001–D-007), `RISK_LOG` (R-001–R-012)
- [x] LLM-wiki `INDEX.md` + 4 substantive pages from surviving research
- [ ] `feature_list.json` — the work ledger
- [ ] GitHub repo created, baseline pushed (blocked: B1/B2)
- [ ] Russian README (bilingual docs requirement)
- [ ] `.opencode/agents/` definitions

**Exit:** GitHub repo exists with a clean baseline commit; the ledger is complete.

### Blockers

| ID | Blocker | Owner |
|---|---|---|
| B1 | `gh` not authenticated — `gh auth login` is interactive, I cannot run it | operator |
| B2 | git identity unset — commits impossible | operator |
| B3 | No affiliate API credentials | operator (apply) |
| B4 | ИП / geo / payout confirmation | operator (email) |
| B5 | No Docker/Postgres locally | accepted, D-005 |

---

## Phase 1 — RESEARCH COMPLETION

Round 1 was **interrupted by rate limits**: R2, R4, R7, R8 saved 31 raw source captures; **R1, R3, R5, R6 saved nothing.** Round 2 resumes all eight, prioritising the gaps below.

### Priority gaps from round 1 (ordered by blocking power)

| # | Gap | Blocks | Track |
|---|---|---|---|
| **G4** | Is a Russian **ИП** eligible for an AliExpress Affiliate API app? | **Everything** | R1 |
| **G2** | Confirmed signing algorithm (MD5/HMAC vs HMAC-SHA256 — sources conflict) | Integration | R1 |
| **G1** | Complete endpoint list with params/responses | Module contract | R1 |
| **G3** | Verified rate limits per API family | Ingestion design | R1 |
| **Payout** | Can a foreign network pay a Russian ИП in 2026? | **Revenue** | R5/R8 |
| **G7** | Does a bulk catalog feed exist (cheaper than API)? | Cost/effort | R1 |
| **G16** | **RU/CIS competitors** — analysis is skewed Western | Positioning | R7 |
| **G10** | Does `.md` twining measurably affect citation? | GEO thesis | new R9 |
| Temu | Does **any** API/feed exist? | Module decision | R3 |
| Networks | Which other networks are joinable **with feeds**? | Phase 4 | R5 |

### Exit criteria

Every gap above is resolved or explicitly marked `UNVERIFIED` with a documented attempt. **G4 and Payout must be resolved — they can invalidate the project.**

---

## Phase 2 — ARCHITECTURE & SPECS (SDD)

**No code before this phase completes** (R3).

### Specs to write

| Spec | Scope |
|---|---|
| `SPEC-001-ingestion-engine.md` | Module plugin contract, idempotent upserts, watermark sync, backoff + dead-letter, **CSV and API sources behind one interface** |
| `SPEC-002-product-identity.md` | ID systems, cross-listing dedup (image hash + normalised title + price fingerprint), GTIN matching |
| `SPEC-003-schema.md` | Postgres-compatible schema; **retention as a first-class column-level policy** |
| `SPEC-004-static-first-web.md` | Next.js static HTML, `.md` twins, `llms.txt` generation, `Link:` headers, robots.txt AI policy |
| `SPEC-005-link-and-attribution.md` | Deep-link construction, tracking, per-network geo policy enforcement |
| `SPEC-006-lander-cost.md` | Landed-cost computation with explicit disclosure of what is **not** included |

### Architecture decisions to settle

| ADR | Question |
|---|---|
| ADR-001 | Static-first Next.js vs Astro for content sites — *note: operator named both; Next.js chosen for the interactive layer, Astro is a strong alternative for pure content* |
| ADR-002 | Cloudflare Pages+Workers vs alternatives — see below |
| ADR-003 | Drizzle vs Prisma (SQLite dev / Postgres prod portability) |
| ADR-004 | How to serve `.md` twins: static files at build vs Workers at request time |

### Hosting options (operator asked)

| Option | Fit | Cost |
|---|---|---|
| **Cloudflare Pages + Workers** | ✅ Recommended. Static HTML at the edge, Workers for the API, R2 for fixtures/images, free tier generous | free → low |
| Cloudflare Workers + D1 | ⚠️ D1 is SQLite-based — would actually align with dev DB, but limits on scale | free → low |
| Vercel | ✅ Strong Next.js DX, but serverless functions and vendor coupling; also **Russian ИП card-payment risk** | free → mid |
| Netlify | ✅ Good static + edge; less Next.js-native than Vercel | free → mid |
| Self-hosted VPS | ⚠️ Full control, but adds ops burden and payment-rail risk | mid |

**Recommendation: Cloudflare Pages + Workers.** Static HTML globally, no cold starts, Workers for the lookup API, and the `Link:` header for markdown discovery can be set in the CDN config without touching pages. ⚠️ **Verify:** whether Cloudflare Pages accepts payment from a Russian ИП, and whether Workers can reach the AliExpress API from Cloudflare's IP ranges (some affiliate APIs block datacenter IPs — untested).

### Exit criteria

All specs approved, all ADRs written, `feature_list.json` fully populated with `passes: false`.

---

## Phase 3 — ENGINE (first vertical slice) · **COMPLETE**

**Milestone definition:** *AliExpress feed ingestion → DB → price history.* CSV
source only, so the build was never blocked by an approval queue we don't
control.

| Step | Feature | State |
|---|---|---|
| 1 | Config + secrets loading (`.env`, never committed — R4) | ✅ `.env.example`, 11 documented blocks |
| 2 | SQLite schema + migrations; Postgres-compatible | ✅ **F011 VERIFIED 11/11** |
| 3 | Module plugin contract + reference CSV module | ✅ CSV ingest behind one interface |
| 4 | Idempotent upsert pipeline with request budgeting | ✅ **F012 VERIFIED 15/15** |
| 5 | Price-history writer with retention policy | ✅ **F013 VERIFIED 10/10** |
| 6 | Postgres FTS index + lookup API (Workers) | ⬜ F014 |
| 7 | AliExpress API module | ⬜ F015 — blocked on credentials (issue #1) |
| 8 | Verifier proves the real path end to end | ✅ `scripts/verify-f0*.ts`, separate DB connection |

**Standing in the engine:** 24 tables, 113 tests, typecheck clean.

### Bugs found by verification, not by reading code

Recorded because the pattern matters more than the individual fixes:

| # | Bug | Why it survived review |
|---|---|---|
| 1 | `?` placeholders bind positionally, so a repeated `$10` shifted every later binding | Looked correct; only failed with 15+ params |
| 2 | Safety match missed `Batteries` for keyword `battery` (different stems) | A safety control that *appears* to work |
| 3 | `[...text]` spread a **string** into characters — title matching never fired | Category matching still worked, so tests looked green |
| 4 | Price observations doubled on replay | `observed_at` in the natural key |
| 5 | Idempotency fingerprint compared a value against itself | Always matched → every run claimed no-op |
| 6 | `rollup_to` stored the literal string `"rollup_to"` | Field existed, so a presence-check passed |

**Lesson recorded for the team:** three of these were *half-working safety or
accounting controls*. They pass a presence check and fail a value check. The
verification scripts assert **values**, not presence.

### Remaining in Phase 3

- **F014** — lookup API with Postgres FTS (needs the Postgres runner for parity)
- **F015** — the live AliExpress module (blocked on credentials)
- **Retention job** — FR-16/FR-17 batched, resumable deletion. Configuration and
  schema exist; the job does not.
- **Module plugin contract** — SPEC-001 FR-1..FR-5 is specified and the CSV
  source implements it implicitly, but no explicit `ModuleContract` type or a
  second module proving plug-in independence (F017) exists yet.

### Multi-level testing (operator asked)

| Level | Scope | Tooling | Runs on |
|---|---|---|---|
| L0 | Type + lint | `tsc`, ESLint | every commit |
| L1 | Unit | Vitest — pure functions: normalisers, dedup scoring, landed-cost math | every commit |
| L2 | Contract | Module interface conformance — every module passes the same plugin test suite | every PR |
| L3 | Integration | Real DB (SQLite in CI), migrations up/down, ingestion against recorded CSV fixtures | every PR |
| L4 | Golden-file | Snapshot of normalised product output — catches unintended changes in dedup/normalisation | every PR |
| L5 | Live smoke | **Real API call** against a sandboxed budgeted request — ⚠️ no sandbox exists, so this needs a strict daily budget and human trigger | nightly, manual |
| L6 | End-to-end | Full journey: fixture → DB → API → rendered static page with correct affiliate link | pre-release |
| L7 | SEO/GEO | Assert 100% of pages contain server-rendered content, valid structured data, working `.md` twins, correct `Link:` headers | pre-release |

**L7 is the regression guard for the operator's HTML-first requirement** — it fails the build if any page becomes JS-dependent.

### Exit criteria

L0–L4 and L7 green. A verifier has confirmed the real path, not just tests.

---

## Phase 4 — DISTRIBUTION (the actual business)

Nothing above matters without traffic. Ordered by value-per-effort.

### 4a — Static sites, Cloudflare, one niche first

Operator noted *"сайтов будет много"* — many sites. **Recommendation: start with ONE site, prove it earns, then replicate.** Many half-built sites earn nothing; one earning site can be cloned cheaply because the engine is shared.

| Step | Detail |
|---|---|
| 1 | One niche site, static HTML, `.md` twins, `llms.txt`, sitemap, robots.txt with AI-bot policy |
| 2 | Structured data (Product, Offer, AggregateRating) |
| 3 | Content generation: product pages + honest comparison pages from the engine's data |
| 4 | LLM-assisted offer selection — score offers on margin × EPC × risk × value-to-user |
| 5 | **Telegram bot** in parallel — deal alerts, price-drop notifications |
| 6 | **Social distribution** — operator suggested **Postiz** (open-source, self-hosted multi-network scheduler). ⚠️ verify: API stability, self-host on Workers, which networks support programmatic posting, and platform ToS on automation |

### 4b — Email → offers (operator asked)

Extracting offers from newsletters (network and creator emails) to build site content. **Compliance note:** this must respect the sender's terms and anti-spam rules. Framing: newsletters you are *entitled* to receive, used to identify *publicly available* offers — not bulk scraping and republishing someone's creative content.

### 4c — Multi-site scaling

Once site #1 earns: replicate the template across niches. The engine, the module contract, and the GEO layer are shared; only content and niche config differ.

### 4d — Traffic, phased (operator asked for both organic and paid)

| Stage | Approach | Gate to next stage |
|---|---|---|
| 1 | **Organic only** — SEO, LLM/GEO, YouTube, Telegram, Pinterest, communities | 1,000 clicks + first commission |
| 2 | **Small paid budget** to validate offers with real CPC/EPC data | Real EPC known |
| 3 | **Scale paid** against proven economics only | — |

⚠️ **The 3-day AliExpress cookie window is the binding constraint on all of this** (see [ALIEXPRESS-AFFILIATE](../wiki/20-affiliate-programs/ALIEXPRESS-AFFILIATE.md)). Content must convert within the click.

---

## PHASE 5 — EXPANSION

- Additional networks with feeds — ranked by feed/API availability, not by commission rate
- Services verticals (insurance, hosting, education) — same engine, different module; note heavier compliance
- **Alibaba.com B2B** — only after geo + ИП eligibility confirmed; needs a **$300–400/order** content strategy, not consumer traffic. Geo-gate B2B pages to non-RU visitors.
- Optional: SaaS-ise the platform itself (multi-tenant) if the operator wants a sellable asset

---

## Standing principles (from `AGENTS.md`)

1. **No code before an approved spec.**
2. **Never fabricate** — `UNVERIFIED` beats a plausible guess.
3. **Verifier required** before any feature is marked done.
4. **Nothing deleted** without double confirmation.
5. **HTML-first.** No content that exists only after JS.
6. **Safety-critical categories excluded** — batteries, chargers, PPE, baby items. Not "warned about" — excluded.
7. **Honesty is the product.** If landed cost says a deal is fake, say so.

---

## "What did we miss?" — gaps in this roadmap

Recorded so they are visible, not forgotten:

| # | Gap | Handling |
|---|---|---|
| M1 | **Analytics instrumentation was not specified.** Without EPC/clicks-by-channel data, phases 4d gates cannot be evaluated and we cannot prove the north star. **Needs a tracking decision** — operator suggested finding and adapting an open-source tracker like Keitaro. | Phase 2 spec |
| M2 | **Monitoring/alerting** — API failure, feed staleness, site-down detection. | Phase 2 spec |
| M3 | **Backup/restore** for the Postgres prod DB. | Phase 2 |
| M4 | **CI/CD** — not yet defined; needs deploy + rollback. | Phase 2 |
| M5 | **Cost model** — Workers/Cloudflare/Pages/R2 + API + LLM calls per month at realistic volume. | Phase 2 |
| M6 | **Data-retention policy specifics** depend on R8's ToS clauses. | Blocked on R8 |
| M7 | **Multi-currency / multi-locale** — audience is global; product titles, prices and shipping vary per destination. Affects schema and URL strategy. | Phase 2 |
| M8 | **Fraud monitoring** — a tracker and a link generator are prime targets for abuse; own-click fraud would destroy EPC data. | Phase 3 |
| M9 | **Legal review of actual content** before launch — R8 gives the framework, but a professional should review the final site's disclosures. | Pre-launch |
| M10 | **Kill criteria** — what result at which checkpoint means *stop* rather than *pivot*? Currently undefined. **This is a real omission.** | Needs operator decision |

## Confidence statement

| Area | Confidence | Why |
|---|---|---|
| LLM/GEO design | **9/10** | Verified against OpenAI + llmstxt.org primary docs |
| AliExpress API shape | **7/10** | Docs solid; eligibility + signing unconfirmed |
| Alibaba B2B terms | **9/10** | Platform's own live page |
| Market gap analysis | **8/10** | Direct competitor observation; skewed Western (G16) |
| Traffic/monetisation | **3/10** | **R6 produced nothing.** Unit economics are essentially unverified. |
| Temu | **0/10** | **R3 produced nothing.** |
| Network landscape | **2/10** | **R5 produced nothing.** |
| RU legal/tax | **6/10** | 5 captures survived; payout mechanics (the critical bit) unresolved |

**The honest summary:** the *technical* direction is well-evidenced. The *commercial* direction — traffic, unit economics, payouts, competitive dynamics in RU/CIS — is not. Round 2 must prioritise R3, R5, R6, and RU-specific competitors (G16) before Phase 4 spends money.
