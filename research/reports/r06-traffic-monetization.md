# R06 — Traffic & Unit Economics

> **Status: BLOCKED — no primary data obtainable this session.** Two attempts to
> dispatch this track failed on provider daily quota. The orchestrator fallback
> pass also failed: `websearch` returned "No search results found" for every
> query, and direct fetches of known benchmark sites failed
> (`chocolatey.com` → DNS failure, `statsonic` → certificate error, `rjaffiliate.com`
> → DNS failure).
>
> **Decision D-020 therefore stands: no paid-traffic spend until this track
> delivers measured numbers.**
>
> Confidence: **3/10**. This document deliberately contains **no invented EPC or
> CPC figures**. It contains the arithmetic framework and the measurement plan
> instead, which is what can honestly be produced without data.

---

## Why there are no numbers in this document

The single most valuable output of this track is a real EPC figure. Producing a
plausible-looking one from memory would be worse than useless: it would be
quoted into the roadmap, drive a budget decision, and be wrong — because
affiliate EPC varies by an order of magnitude across vertical, geo, traffic type
and season, and because the sources that publish such figures (agencies,
networks) sell something and are structurally biased.

**R2 applies with full force here.** What follows is the framework that will
consume the real numbers when they arrive.

---

## The arithmetic framework

Unit economics for affiliate are governed by one relationship. Everything else
is downstream of it:

```
monthly revenue = clicks × EPC
EPC             = revenue_per_click × click_to_sale_conversion_rate
```

Inverting gives what the operator actually needs — **traffic required**:

```
clicks_needed = target_monthly_revenue / EPC
```

### Worked structure (variables are NOT values)

| Variable | Symbol | Status |
|---|---|---|
| Target monthly income | `T` | operator sets it |
| EPC by channel | `EPC_c` | **UNKNOWN — to be measured** |
| Conversion rate | `CR_c` | **UNKNOWN — to be measured** |
| Average order value | `AOV_c` | **UNKNOWN — to be measured** |
| Commission rate | `rate_c` | **UNKNOWN — to be measured per network** |
| CPC by channel | `CPC_c` | **UNKNOWN — to be measured** |
| Traffic acquisition cost | `TAC = CPC / CR` | derived |

The critical derived metric is **TAC** (cost per acquisition). Paid traffic is
only viable when `TAC < EPC`, i.e. when `CPC < EPC × CR`. This must be measured
per channel, not assumed.

### The constraint already verified

From `docs/wiki/20-affiliate-programs/ALIEXPRESS-AFFILIATE.md`: the AliExpress
affiliate cookie window is **3 days**, and the commission rate is **0–9%**
(nominal), with only "Hot Products" reaching up to 90%.

**INFERENCE (high confidence, from verified facts only):** a 3-day window with a
sub-10% nominal rate is a thin-margin structure. Combined with the fact that the
majority of affiliate revenue in physical goods accrues to a minority of high-
commission categories, the realistic planning assumption is that **EPC must be
measured per niche, not assumed from a network-average.** A niche advertising
itself at 90% commission and one advertising itself at 2% are not the same
business, and mixing them in one average would be an analytical error.

---

## What must be measured, and how

### Phase A — desk research (BLOCKED, this session)

Benchmark EPC/CPC data by vertical and geo from network-published reports.
⚠️ Label every such figure `VENDOR-REPORTED`. Networks and agencies publish
benchmarks to attract publishers; they are systematically optimistic.

### Phase B — the project's own measurement (NOT STARTED)

Once a site has traffic, the only trustworthy numbers are ours. Required
instrumentation before any traffic decision:

| # | Requirement | Why |
|---|---|---|
| 1 | Per-channel click tracking | Without it, EPC per channel is uncomputable |
| 2 | Conversion event recording, tied to the click | The click→sale join is the whole measurement |
| 3 | Commission reconciliation per order | Platform-reported vs earned — the delta is where fraud and misattribution hide |
| 4 | Split by network, niche, and creative | Aggregates hide the profitable cells |
| 5 | Cookie-window-shortened conversions identified | 3-day window means late conversions are invisible |

⚠️ **Analytics instrumentation is gap M1 in the roadmap and is currently
unspecified.** It is a prerequisite for this entire track, not a later
nice-to-have. The operator suggested adapting an open-source tracker (Keitaro
class); that remains an open decision (D-021 era, `ROADMAP.md` M1).

### Phase C — the smallest honest test

A small paid test against one niche, with a hard stop-loss, purely to buy a
measured EPC. Rationale: it is cheaper to learn the true EPC with a capped
spend than to build traffic strategy on a guessed one.

**Gate:** do not scale past this until a measured EPC exists and
`CPC < EPC × CR` is demonstrated for at least one channel.

---

## The 12–18 traffic ideas (DEFERRED)

The synthesis deliverable — concrete, ranked traffic ideas — **is not produced
here.** Producing a list of "SEO, YouTube, TikTok, Pinterest…" from memory would
reproduce the generic advice that already saturates this niche, and would carry
none of the specificity that made the R7 competitive analysis valuable
(`docs/wiki/60-product-synthesis/COMPETITIVE-LANDSCAPE.md`).

**Deferred, not abandoned.** The synthesis depends on: (a) real EPC data, (b)
verified channel policy constraints, (c) RU/global competitive data (gap G16,
still open). None of those are available. Writing the list now would be theatre.

---

## What IS actionable from this pass

Three conclusions follow from verified facts, not from missing data:

1. **The 3-day cookie window is the binding constraint on strategy.** Any traffic
   plan must convert within the click. Long consideration cycles, remarketing
   funnels, and email nurture to convert a 3-day-old click are structurally
   impaired on AliExpress specifically. Networks with 10–30 day windows should be
   weighted higher when prioritising sources.

2. **Category commission dispersion is the real margin story.** 0–9% nominal,
   up to 90% on Hot Products. Niche selection determines economics far more than
   traffic tactics do. This should be measured *before* traffic is bought.

3. **The GEO thesis does not depend on R6.** The LLM-discoverability thesis
   (`docs/wiki/50-strategy-traffic/LLM-DISCOVERABILITY.md`, confidence 9/10,
   verified against OpenAI and llmstxt.org primary docs) is independent of any
   EPC figure. It is the one traffic thesis in this project currently resting on
   verified evidence rather than missing benchmarks — which makes organic/GEO
   work the correct first investment while R6 stays blocked.

---

## GAPS

| # | Gap | Blocking? |
|---|---|---|
| **G25** | EPC/CPC/CR/AOV by channel and niche — no source obtainable this session | **YES — blocks all traffic spend** |
| **G26** | Per-network commission rates (see R05 gap G17) | YES — determines which networks are worth integrating |
| **G27** | Analytics/tracking decision (M1) | YES — measurement is impossible without it |
| **G28** | Channel policy constraints 2026 (monetisation eligibility, automation rules) | No — can be gathered during phase 4a |
| **G29** | RU/CIS traffic economics (G16) | No — audience is global/English-first per D-021 |

**Method note:** both agent dispatches died on `free-models-per-day-high-balance`.
`websearch` returned empty for all queries. Direct fetches to three benchmark
sources failed on DNS/certificate errors. No figure in this document is estimated
from memory — that is the point.
