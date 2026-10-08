# Unit Economics — Framework (data blocked)

> **Summary:** R06 is **BLOCKED**. No EPC/CPC/CR data was obtainable this session (two agent dispatches died on provider quota; `websearch` returned empty for every query; three benchmark sources failed DNS/certificate). **This page contains no invented figures** — deliberately. It holds the arithmetic framework, the derived metric that decides paid vs organic, and the measurement plan.
>
> Confidence: **3/10** on any numeric conclusion. **9/10** on the framework itself.

## Why there are no numbers here

EPC varies by an order of magnitude across vertical, geo, traffic type and season.
Published benchmarks come from networks and agencies **that sell something**, so
they are structurally optimistic.

A plausible-looking EPC from memory would be quoted into the roadmap, drive a
budget decision, and be wrong. **D-020 stands: no paid-traffic spend until measured.**

## The governing relationship

```
monthly revenue = clicks × EPC
EPC             = revenue_per_click × click_to_sale_conversion_rate
clicks_needed   = target_monthly_revenue / EPC
```

| Variable | Status |
|---|---|
| Target monthly income `T` | operator sets |
| EPC by channel `EPC_c` | **UNKNOWN** |
| Conversion rate `CR_c` | **UNKNOWN** |
| AOV / commission rate | **UNKNOWN per network** |
| CPC by channel `CPC_c` | **UNKNOWN** |

### The decisive derived metric

```
TAC (cost per acquisition) = CPC / CR
Paid traffic viable  ⟺  TAC < EPC  ⟺  CPC < EPC × CR
```

This must be **measured per channel**, never assumed. An aggregate average hides
the profitable cells and the money-losing ones simultaneously.

## The constraint already verified

From [ALIEXPRESS-AFFILIATE](../20-affiliate-programs/ALIEXPRESS-AFFILIATE.md):

- Cookie window: **3 days**
- Commission: **0–9%** nominal, up to 90% on Hot Products only

**INFERENCE (high confidence, from verified facts only):** a 3-day window with a
sub-10% nominal rate is a thin-margin structure. And because revenue
concentrates in a minority of high-commission categories, **EPC must be measured
per niche**. A niche advertising Hot Products at 90% and one advertising itself at
2% are not the same business — averaging them would be an analytical error.

## Three conclusions that need no missing data

1. **The 3-day cookie is the binding strategic constraint.** Content must convert
   within the click. Long consideration cycles, remarketing funnels and email
   nurture against a 3-day-old click are structurally impaired on AliExpress
   specifically. Networks with 10–30 day windows should be weighted higher when
   prioritising sources.

2. **Category commission dispersion matters more than traffic tactics.** Niche
   selection determines economics. Measure commission rates *before* buying
   traffic.

3. **The GEO thesis does not depend on R06.** [LLM-DISCOVERABILITY](../50-strategy-traffic/LLM-DISCOVERABILITY.md)
   is verified at 9/10 against OpenAI and llmstxt.org primary docs and is
   independent of any EPC figure. **It is the one traffic thesis in this project
   resting on verified evidence rather than missing benchmarks** — which makes
   organic/GEO the correct first investment while R06 stays blocked.

## Measurement plan (Phase B — not started)

| # | Requirement | Why |
|---|---|---|
| 1 | Per-channel click tracking | EPC per channel is otherwise uncomputable |
| 2 | Conversion event tied to the click | The click→sale join *is* the measurement |
| 3 | Commission reconciliation per order | The delta is where fraud and misattribution hide |
| 4 | Split by network, niche, creative | Aggregates hide everything useful |
| 5 | Flag conversions outside the cookie window | 3-day window makes late conversions invisible |

⚠️ **Analytics instrumentation is roadmap gap M1 and is still unspecified.** It is
a prerequisite for this entire page, not a later nice-to-have.

### Phase C — the smallest honest test

A small paid test against one niche, with a hard stop-loss, purely to buy a
measured EPC. Cheaper to learn the true number with capped spend than to build a
traffic strategy on a guessed one.

**Gate:** no scaling until measured EPC exists and `CPC < EPC × CR` is
demonstrated for at least one channel.

## Why the 12–18 traffic ideas are absent

Producing "SEO, YouTube, TikTok, Pinterest…" from memory would reproduce the
generic advice that already saturates this niche, carrying none of the
specificity that made the R7 competitive analysis valuable. The synthesis depends
on real EPC data, verified channel policy, and RU/global competitive data (G16,
still open). **Deferred, not abandoned** — writing it now would be theatre.

## Gaps

| # | Gap | Blocking? |
|---|---|---|
| G25 | EPC/CPC/CR/AOV by channel and niche | **YES — blocks all traffic spend** |
| G26 | Per-network commission rates | **YES** |
| G27 | Analytics/tracking decision (M1) | **YES — measurement impossible without it** |
| G28 | Channel policy constraints 2026 | No — gather in phase 4a |
| G29 | RU/CIS traffic economics (G16) | No — audience is global per D-021 |

Full detail: `research/reports/r06-traffic-monetization.md`
