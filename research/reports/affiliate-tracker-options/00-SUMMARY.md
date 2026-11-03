# Affiliate Tracker Options — Research Summary

**Date:** 2026-11-03
**Decision context:** Issue #2 — "Decide analytics + click tracking (roadmap gap M1)"
**Project:** alibaba-ali-temu-affiliate-platform
**North star:** First real commission received (F027)

---

## Executive Summary

We need click/channel tracking (F023) and EPC measurement to unblock paid traffic (D-020) and reach first commission (F027). Three paths exist:

| Path | Verdict | Rationale |
|------|---------|-----------|
| **Commercial self-hosted (Keitaro/Binom)** | **RECOMMENDED for MVP** | Fixed price, full features, S2S postback ready, AliExpress/Alibaba templates exist, 14-day trials. Cost: $49-99/mo. |
| **Open-source self-hosted (AffEasy/Refearn/Cliq)** | NOT READY | Alpha/beta, AGPL-3.0 (viral), missing AliExpress S2S templates, no proven postback reliability. |
| **Build minimal tracker** | **PARALLEL TRACK** | Our stack (Next.js + SQLite/Postgres + ModuleContract) can implement click→postback→EPC in 1-2 weeks. Lowest long-term cost, full control. |

**Recommended strategy:** Start with **Keitaro self-hosted** ($49/mo Starter, 14-day trial) for immediate F023/F026 unblocking. Build **minimal internal tracker** in parallel (uses existing ModuleContract + click_event schema). Migrate when internal covers 80% of needs.

---

## Options Analyzed

### 1. Commercial Self-Hosted Trackers

#### Keitaro (Apliteni OÜ, Estonia)
- **Pricing:** Starter $49/mo (1 domain, 1 user), Advanced $89 (100 domains), Expert $129 (500 domains), Team $249 (5000), Enterprise $499 (unlimited). 14-day trial.
- **Hosting:** Self-hosted on own VPS (requirements: 2 CPU, 4GB RAM, 50GB SSD minimum). Cloud option exists.
- **API:** Click API + Admin API (REST, JSON). Campaign/stream/offer/domain management. Postback templates for 120+ networks.
- **AliExpress/Alibaba:** Documented S2S postback setup. Alibaba B2B uses `{pid}`, `{tp1}`, `{ord_id}` params. AliExpress Portals supports postback URL config.
- **License:** Proprietary. No source access.
- **Status:** Mature (since 2012), 4000+ businesses, active development (Keitaro 11 released 2025).

#### Binom (Binom.org)
- **Pricing:** $99/mo first tracker, +$49/additional. Yearly $149/mo (30% off). Fixed price — **no traffic limits**, unlimited domains/users. 30-day trial.
- **Hosting:** Self-hosted (1-click install script). Cloud option ($149/mo includes server). Free installation on your server.
- **API:** API v1 (reports, costs, offers, landings) + API v2 (object editing). Click API for real-time tracking.
- **AliExpress/Alibaba:** Postback v2 documented. Template-based setup. 120+ network templates.
- **License:** Proprietary. "We install tracker on your server for free."
- **Status:** 2000+ customers, 60 countries, handles 260M clicks/day. Version 2 current.

#### Comparison
| Factor | Keitaro | Binom |
|--------|---------|-------|
| Entry price | $49/mo | $99/mo |
| Traffic limits | None | None |
| Domains (starter) | 1 | Unlimited |
| Team/users | Limited by plan | Unlimited |
| API maturity | Admin + Click API | API v1 + v2 |
| AliExpress templates | Yes | Yes |
| Trial | 14 days | 30 days |
| Install support | Docs | Free 1-click install on your server |

---

### 2. Open-Source Self-Hosted Trackers

| Project | License | Status | Stack | S2S/Postback | AliExpress Ready? |
|---------|---------|--------|-------|--------------|-------------------|
| **AffEasy** (afftester/affeasy) | AGPL-3.0 | Active (3133 commits) | Next.js, TypeScript, Upstash, PlanetScale, Tinybird | Postback docs exist, "Unified Network Access" claimed | **No** — no AliExpress template found |
| **RefearnApp** (ZAK123DSFDF/refearnapp) | AGPL-3.0 | Active (1400 commits) | Next.js, Cloudflare Edge, Drizzle, Docker | Postback system for their own network | **No** — built for referral programs, not affiliate networks |
| **Cliq** (org-quicko/cliq) | Unclear | Early (254 commits) | NestJS, Angular, TypeORM/Prisma | "Referral tracking and commission calculation" | **No** |
| **RefRef** (refrefhq/refref) | AGPL-3.0 | **Alpha** (113 commits) | Next.js, Drizzle, PostgreSQL | Referral attribution, postbacks | **No** — "expect bugs and breaking changes" |
| **Affiliate Postback Engine** (UjjwalSaini07) | MIT | MVP (53 commits) | Next.js, Express, PostgreSQL | S2S postback MVP, click tracking | **No** — no network templates |
| **Affiliate Tracking** (programmer2807) | Unspecified | Early | React, Node/Express, PostgreSQL | Basic postback endpoint | **No** |

**Critical findings:**
- All are **referral/partner program** tools (run your own affiliate program), not **affiliate network** trackers (track clicks from external networks like AliExpress).
- **AGPL-3.0** is viral — any modification deployed as a service must be open-sourced. Incompatible with proprietary SaaS.
- No AliExpress/Alibaba/Amazon postback templates found in any.
- Most are alpha/beta with "expect bugs" warnings.

---

### 3. S2S Postback Integration — Network Support

#### AliExpress (Portals)
- **Auth:** Tracking ID + Keystring (App Key) + App Secret — all from same Portals account
- **Postback config:** `https://ads.alibaba.com/postbackUrl.htm` (Alibaba B2B) / Portals for AliExpress
- **Params:** `{pid}` (pubid), `{tp1}` (clickid), `{ord_id}`, `{est_com}` (commission)
- **Cookie window:** 60 days
- **API:** AliExpress Affiliate API (TOP protocol, HMAC/MD5 signing) — separate from postback

#### Alibaba.com B2B
- **Postback config:** `https://ads.alibaba.com/postbackUrl.htm`
- **Example:** `https://your-server?pubid={pid}&clickid={tp1}&commission={est_com}&source=alibaba`
- **Params:** `{pid}`, `{tp1}`, `{ord_id}`, `{est_com}`
- **Cookie:** 60 days
- **Caveat:** Refuses Russian traffic, blocks MMP attribution

#### Amazon Associates / Creators API
- **Postback:** Not standard — uses API (PA-API 5 deprecated, Creators API current)
- **Tracking:** SubID in links, reporting via API
- **No traditional S2S postback** from Amazon to tracker

#### CJ Affiliate / Awin / Impact / Rakuten
- **Postback:** Supported via network templates in Keitaro/Binom
- **API:** Available (CJ has deep linking, commission detail APIs)

---

### 3. Build Minimal Internal Tracker (Our Stack)

**We already have:**
- `click_event` table (SPEC-005) with `channel`, `click_id`, `sub_ids`, `ip_hash`, `user_agent`
- `conversion_event` table with `click_event_id`, `network_report_id`, `status` (pending/confirmed/rejected)
- `commission_record` with `conversion_event_id`, `amount_minor`, `currency`, `reconciled`
- `ModuleContract` — pluggable sources
- `safety_exclusion` gate — pattern for pre-write validation

**Missing for MVP:**
1. **Click endpoint** — `/click?affiliate_id=&campaign_id=&sub1=&sub2=` → generates `click_id`, stores `click_event`, redirects
2. **Postback endpoint** — `/postback?click_id=&amount=&currency=&status=` → validates `click_id`, creates `conversion_event`
3. **EPC aggregation** — SQL view: `SUM(commission) / COUNT(clicks) GROUP BY channel`
4. **Admin API** — CRUD for campaigns, offers, postback templates

**Estimated effort:** 1-2 weeks (our stack + existing schema = 80% done).

---

## ToS / Legal Review

| Source | Scraping Allowed? | API Terms | Postback Terms |
|--------|-------------------|-----------|----------------|
| Keitaro/Binom | N/A (self-hosted) | Proprietary EULA | Network templates provided |
| AffEasy/Refearn/Cliq | N/A | AGPL-3.0 (viral) | No AliExpress template |
| AliExpress Portals | **Prohibited** (JS-rendered docs) | API agreement required | Postback config in Portals |
| Alibaba.com B2B | Prohibited | API agreement | Postback in ads.alibaba.com |
| Amazon Associates | Prohibited | Creators API terms | No S2S postback |
| CJ/Awin/Impact | Prohibited | Network agreements | Network templates in Keitaro/Binom |

**Key risk:** AliExpress/Alibaba Portals docs are JS-rendered (G20/G21/G24) — cannot scrape for API details. Must apply for Portals account first.

---

## Monetisation / Unit Economics (D-020 / Gap G25)

| Cost Item | Keitaro Starter | Binom | Build Internal |
|-----------|-----------------|-------|----------------|
| Monthly | $49 | $99 | $0 (dev time) |
| VPS (2CPU/4GB/50GB) | ~$10-20 | ~$10-20 | ~$10-20 |
| **Total/mo** | **$59-69** | **$109-119** | **~$10-20 + dev** |
| Break-even vs Build | 1-2 mo | 2-3 mo | Immediate |

**EPC requirement:** Must exceed CPC. With no EPC data (gap G25), D-020 forbids paid traffic spend. **Tracker is prerequisite for first EPC measurement.**

---

## Conflicts & Resolutions

| Conflict | Resolution |
|----------|------------|
| Keitaro vs Binom price | **Keitaro Starter** for MVP (lower entry, 1 domain OK for single site) |
| Commercial vs Open-source | **Commercial for MVP** — open-source lacks AliExpress templates, AGPL risk |
| Build vs Buy | **Parallel** — Buy Keitaro now (14-day trial → $49/mo), build internal in background |
| AGPL-3.0 viral license | **Exclude** all AGPL trackers from production use |

---

## Gaps (What Could Not Be Determined)

1. **Exact AliExpress Portals postback parameter list** — docs are JS-rendered (G20/G21/G24), need live account
2. **Keitaro/Binom AliExpress template completeness** — trial needed to verify
3. **Internal tracker dev time** — estimate 1-2 weeks, but depends on postback template complexity
4. **Cloudflare Pages + Keitaro VPS latency** — need to test from target GEOs
5. **Postback IP whitelisting** — networks require whitelisted IPs; Cloudflare Pages IPs rotate

---

## Adversarial Self-Critique

| Check | Status |
|-------|--------|
| Claims with no source | ❌ Keitaro/Binom AliExpress template claim — based on marketing pages, not verified in trial |
| Sources that disagree | ⚠️ Binom claims "unlimited domains" on starter; Keitaro limits to 1. Verified on pricing pages. |
| Stale sources | ⚠️ Some search results from 2024; Keitaro 11 released 2025, Binom v2 current. |
| Assumptions as facts | ⚠️ "1-2 weeks to build internal" — assumes postback templates are simple. Could be 3-4 weeks. |
| Derived numbers | ✅ VPS cost ~$10-20 from Timeweb/standard providers (measured separately) |
| Unasked questions | ❌ **GDPR/cookie compliance** for click tracking — need legal review. **IP hashing** already in schema (SPEC-005 NFR-5). |
| Commercial blind spots | ⚠️ Keitaro/Binom lock-in: migration effort if we switch. Need export capability check. |
| Legal exposure | ❌ **No legal review** of AliExpress Portals API agreement. Must happen before F015. |

---

## Recommendation to Operator

**Decision required:** Approve Keitaro Starter ($49/mo + VPS) for 14-day trial starting this week.

**If approved:**
1. Provision VPS (Timeweb Cloud, 2CPU/4GB/50GB SSD, ~$15/mo with referral `?i=35886`)
2. Install Keitaro (1-click or manual)
3. Configure AliExpress Portals postback → verify template works
4. Run 14-day trial with real traffic (organic first, per D-020)
5. **Parallel:** Start internal tracker build (click endpoint → postback endpoint → EPC view)

**If not approved:** Internal build becomes critical path. F023/F026/F027 all blocked until tracker exists.