# Commercial Self-Hosted Trackers — Detailed Analysis

## Keitaro (Apliteni OÜ)

**Source:** keitaro.io, blog.keitaro.io, open.keitaro.io, keitaro.io/pricing-individual
**Retrieved:** 2026-11-03
**Type:** reported (vendor site + blog + reviews)

### Pricing (2025)
| Plan | Monthly | Yearly (30% off) | Domains | Users | Trial |
|------|---------|------------------|---------|-------|-------|
| Starter | $49 | $34/mo | 1 | 1 | 14 days |
| Advanced | $89 | $62/mo | 100 | 1 | 14 days |
| Expert | $129 | $90/mo | 500 | 5 | 14 days |
| Team | $249 | $174/mo | 5,000 | 50 | 14 days |
| Enterprise | $499 | $349/mo | Unlimited | Unlimited | 14 days |

**Note:** No traffic volume limits on any plan. "Whether you track 10,000 or 10 million clicks, your costs stay the same."

### Hosting
- **Self-hosted:** Your VPS. Minimum: 2 CPU, 4GB RAM, 50GB SSD. Recommended: 4 CPU, 8GB RAM, 100GB SSD.
- **Cloud option:** Keitaro Cloud (managed) — pricing not public, contact sales.
- **OS:** Linux (Ubuntu 20.04/22.04, Debian 11/12, CentOS 7/8).
- **Install:** 1-click script or manual. Docker available.

### API
- **Click API:** Real-time click data, campaign/stream/offer targeting.
- **Admin API:** Campaign/stream/offer/domain/source/landing management. REST + JSON.
- **Postback templates:** 120+ network templates including AliExpress, Alibaba, Amazon (via API), CJ, Awin, Impact.

### AliExpress / Alibaba Support
- **Alibaba.com B2B:** Documented at ads.alibaba.com/help/getcode.htm
  - Tracking link: `http://click.alibaba.com/rd/InMw9Ka?pid={pubid}&tp1={clickid}&...`
  - Postback URL: `https://ads.alibaba.com/postbackUrl.htm`
  - Example postback: `https://your-server?pubid={pid}&clickid={tp1}&commission={est_com}&source=alibaba`
  - Params: `{pid}`, `{tp1}`, `{ord_id}`, `{est_com}`
  - Cookie: 60 days
- **AliExpress Portals:** Postback config in Portals dashboard. Tracking ID + Keystring + App Secret required.
- **Cookie window:** 60 days for both.

### Reviews (Trustpilot / Keitaro site)
- 4.7/5 average, 100+ reviews
- Common praise: "Best tracker in market", "Support is best I've seen", "Price unbeatable"
- Common criticism: UI dated, learning curve steep

---

## Binom (Binom.org)

**Source:** binom.org, binom.org/price, docs.binom.org, blog.binom.org
**Retrieved:** 2026-11-03
**Type:** reported (vendor site + docs + FAQ)

### Pricing (2025)
| Plan | Monthly | Yearly (30% off) | Domains | Users | Trial |
|------|---------|------------------|---------|-------|-------|
| Binom v2 | $99 | $149/mo ($104/mo yearly) | Unlimited | Unlimited | 30 days |
| Additional trackers | +$49 | — | — | — | — |
| Binom v1 (legacy) | $49 | — | Unlimited | Unlimited | 14 days |
| Cloud | $149/mo | — | Unlimited | Unlimited | 7 days |

**Key differentiator:** "Fixed price — no traffic limits, no domain limits, no user limits." One price for all features.

### Hosting
- **Self-hosted:** 1-click install script. Free installation on your server by Binom team.
- **Cloud:** $149/mo includes server, monitoring, optimization.
- **Requirements:** PHP 8.1+, MySQL 8.0+/MariaDB 10.6+, Redis, Nginx/Apache.
- **Auto-updates:** 1-click from interface. Updates ~monthly.

### API
- **API v1:** Reports (campaigns, landers, offers, sources), cost updates, offer/landing CRUD.
- **API v2:** api.binom.org/v2 — object editing (create/update/delete campaigns, offers, etc.)
- **Click API:** Real-time tracking, campaign/stream/offer selection.
- **Postback v2:** Documented at docs.binom.org/postback-v2.php. Template-based.

### AliExpress / Alibaba Support
- Postback v2 supports network templates. 120+ templates.
- Binom docs mention "affiliate network templates" — load template, select network when creating offer.
- FAQ: "Almost all affiliate networks support postback parameters... contact your affiliate network's customer support."

### Reviews
- 2000+ customers, 60 countries
- Handles 260M clicks/day
- "Fixed pricing model — no traffic limits, no domain limits, no user limits"

---

## Comparison Matrix

| Criterion | Keitaro Starter | Binom v2 |
|-----------|-----------------|----------|
| Monthly cost | $49 | $99 |
| Domains | 1 | Unlimited |
| Users | 1 | Unlimited |
| Traffic limit | None | None |
| Trial | 14 days | 30 days |
| Install help | Docs | Free 1-click on your server |
| API versioning | Admin + Click API | v1 + v2 |
| Postback templates | 120+ | 120+ |
| AliExpress template | Documented (Alibaba B2B) | Template-based |
| UI/UX | Modern (Keitaro 11) | Functional, dated |
| Support | "Best I've seen" | Live chat, email, Telegram |

---

## Recommendation for Our Use Case

**Keitaro Starter ($49/mo)** for MVP because:
1. Lower entry cost ($49 vs $99)
2. 1 domain sufficient for single site MVP
3. 14-day trial sufficient to validate AliExpress postback
4. Modern UI (Keitaro 11) = faster onboarding
5. Can upgrade to Advanced ($89) if multi-domain needed

**Binom advantages if we scale:**
- Unlimited domains from day one
- Fixed price regardless of team size
- Free server installation by Binom team

**Decision:** Start Keitaro 14-day trial. If AliExpress postback works, continue. Evaluate Binom at 3-month mark if team grows.