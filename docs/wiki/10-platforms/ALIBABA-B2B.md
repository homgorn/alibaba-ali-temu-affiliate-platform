# Alibaba.com B2B — Affiliate Reality

> **Summary:** An official Alibaba.com B2B affiliate program **does exist** (ads.alibaba.com, CPS/CPI/KOL, up to 15% commission, 200M+ products). This refutes the common assumption that B2B has no affiliate surface. **However it explicitly refuses traffic from Russia** — which matters enormously given the operator is an ИП. Separately, 1688 and 淘宝联盟 are effectively closed to non-Chinese entities.
>
> Confidence: **9/10** (primary source, platform operator's own live page).

## The programme (HARD FACT)

Primary source: https://ads.alibaba.com/ — Alibaba.com Hong Kong Limited, accessed 2026-10-08.

> "Monetize your traffic with the Alibaba.com Affiliate Program with one membership. Join our CPS, CPI, and KOL programs to boost your earnings effortlessly! 200M+ Affiliate Products 200+ Supported Countries Up to 15% Commission Rate"

Three sub-programmes: **CPS** (per sale), **CPI** (per app install), **KOL** (influencer content collaboration).

## Commission table (updated 1 July 2026)

| Buyer | Order value | Commission |
|---|---|---|
| New buyer | < $5,000 | 8% of order price |
| New buyer | $5,000–$10,000 | flat $300/order |
| New buyer | > $10,000 | flat $400/order |
| Existing buyer | < $5,000 | 3% of order price |
| Existing buyer | $5,000–$10,000 | flat $100/order |
| Existing buyer | > $10,000 | flat $200/order |
| New buyer, **Core Country**, first order ≥ $500 | any | **+ $20 bonus** (stacks) |

**Core Countries** (verbatim): "US, CA, AU, UK, GB, FR, NL, DE, IT, ES, CH, PL, BE, SE, IE, AT, DK, CZ, MX, KR, and JP."

**INFERENCE / high-confidence read:** B2B economics are *fundamentally different* from B2C affiliate. One $8,000 order yields $300 — the equivalent of thousands of low-value consumer clicks. This is a high-ticket, low-volume business. It suits content that captures *purchase intent*, not impulse browsing. New-buyer weighting (8% vs 3%) means the business rewards net-new demand generation, not retargeting an existing base.

## The blocking constraint — Russia is excluded (HARD FACT)

> "NOT accept traffic from ... Russia, Nigeria, Cuba, Iran, North Korea, Syria and Ukraine, and orders from these countries are not ... for commissions."

**Consequence for this project — and it is decisive:**

- The operator is an **ИП** (Russian individual entrepreneur).
- The chosen target geography is **Global / English-first**.
- These two answers are *compatible* — but only if the operator serves non-Russian traffic.
- **Any B2B attempt aimed at Russian buyers earns zero commission.** If an ИП promotes Alibaba.com B2B to a Russian audience, the entire programme is worthless to them.
- A Russian ИП *may* still be accepted as an affiliate **entity** promoting to US/EU/UK/AU/JP traffic. This is an **INFERENCE, not verified** — it is the single most important thing to confirm with `ads@alibaba.com` before any B2B work.

**Action:** email `ads.alibaba@service.alibaba.com` with two questions — (1) can a Russian-registered ИП hold an affiliate account? (2) is the account tied to the entity's country such that it may only promote to non-excluded geos?

## Qualified-order rules (HARD FACT)

> "Order Status must be 'Trade Completed'. It means we will only process the commission to our affiliate partner once the order status changes to 'TradeCompleted'."

Plus: spam status must be `N`; gap between Order Completed Date and Order Paid Date must be **< 180 days**.

**INFERENCE:** cash arrives very late — after delivery is confirmed, and orders can sit long. Cash-flow planning must assume months of delay. This differs sharply from AliExpress, where commissions typically settle much faster.

## Attribution — no MMP (HARD FACT, operationally severe)

> "Tracking System: Alibaba.com affiliate programs do not work with MMP or AppsFlyer. We have an internal anti-cheating system, and we only use our own attribution system."

**Consequence:** no server-to-server postback, no AppsFlyer, no MMP of any kind. Attribution must run through AliExpress/Alibaba's own system — meaning the operator cannot run a Keitaro-style tracker for B2B, and cannot server-side verify conversions. Postback support for B2B must be assumed **absent** until proven otherwise.

## Anti-fraud (HARD FACT)

> "Alibaba.com shall assess the contribution of each order based on traffic quality and user quality. No commission shall be payable for any non-compliant order."

Traffic-quality scoring means low-quality or incentivised traffic can be retroactively voided. This argues strongly for content-led, high-intent promotion over volume clicks.

## Application (HARD FACT)

> "Our affiliate team will approve qualified account applications. Should your application not be approved within 3 days, please email your Affiliate ID (AID) to ads.alibaba@service.alibaba.com for inquiry."

Manual approval. Not instant. No public API documentation for the affiliate programme was found on this page.

## 1688 and 淘宝联盟 — effectively closed (CONFIDENCE: MEDIUM-HIGH)

| Surface | Finding | Label |
|---|---|---|
| 1688 cross-border | Real activity exists but is organised around **agents/sourcing services**, not a public self-serve affiliate API. | INFERENCE |
| 1688 dropshipping | Mechanically: you buy via an agent who holds a 1688 account. You are **not** the supplier. Margin comes from price arbitrage between 1688 and your storefront. | INFERENCE |
| 淘宝联盟 / Taobao Union | Requires Chinese entity credentials; not a realistic path for a foreign ИП. | INFERENCE |

⚠️ These three rows rest on **secondary and Russian-language commentary**, not primary platform documentation. They are `CONFIDENCE: LOW-MEDIUM` and are queued for research round 2. Do not let them become load-bearing in a spec until verified.

## Implication for the roadmap

1. **B2B is a phase-3+ opportunity, not phase 1.** It is gated on an email confirmation about ИП eligibility, and it needs high-ticket content that a new site cannot yet produce.
2. **It is, however, the highest-margin-per-sale surface found in round 1** — worth a dedicated spec later.
3. It carries a hard rule: **B2B pages must geo-gate.** Serving B2B content to a Russian IP risks both zero commission and ToS friction.

Provenance: `research/raw/r02-alibaba-b2b-platform/001-alibaba-affiliate-program.md`
