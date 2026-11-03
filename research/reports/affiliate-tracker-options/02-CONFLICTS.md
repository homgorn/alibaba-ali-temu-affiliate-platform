# Conflicts & Resolutions

## Conflict 1: Keitaro vs Binom Entry Price

**Conflict:** Keitaro Starter $49/mo (1 domain) vs Binom $99/mo (unlimited domains)

**Sources:**
- Keitaro pricing page: Starter $49/mo, 1 domain, 1 user
- Binom pricing page: $99/mo, unlimited domains/users

**Resolution:** **Keitaro Starter for MVP.**
- Single domain sufficient for Phase 1 site
- 14-day trial vs 30-day (both sufficient)
- Lower entry risk: $49 vs $99 for validation
- Can upgrade to Binom later if multi-domain needed

**Confidence:** 9/10 — pricing pages current as of 2026-11-03

---

## Conflict 2: Open-Source "Affiliate Tracker" Category

**Conflict:** Search results show "open-source affiliate trackers" but they're all referral-program platforms (merchant-side), not affiliate-network trackers (publisher-side).

**Sources:**
- AffEasy: "create affiliate links from every major affiliate network" — but AGPL-3.0 + no AliExpress template
- RefearnApp: "alternative to Rewardful, FirstPromoter, Tolt" — referral programs
- RefRef: "referral management platform" — alpha
- Cliq: "affiliate software for startups" — promoter management

**Resolution:** **Open-source trackers are wrong category.** They help merchants RUN affiliate programs. We are a PUBLISHER tracking clicks on merchant networks. Different data flow.

**Confidence:** 10/10 — verified by reading each README and feature list

---

## Conflict 3: AGPL-3.0 vs Proprietary SaaS

**Conflict:** Top open-source options (AffEasy, RefearnApp, RefRef) use AGPL-3.0 which requires open-sourcing modifications if deployed as a service.

**Sources:**
- AffEasy LICENSE.md: "GNU Affero General Public License Version 3"
- RefearnApp LICENSE: AGPL-3.0
- RefRef LICENSE: AGPL-3.0

**Resolution:** **Exclude all AGPL-3.0 trackers from production use.** Our project is proprietary SaaS (eventually). AGPL-3.0 Section 13 requires offering source to users interacting with the software over a network. Incompatible.

**Confidence:** 10/10 — AGPL-3.0 terms are clear

---

## Conflict 4: Keitaro/Binom AliExpress Template Claims

**Conflict:** Both claim AliExpress/Alibaba postback templates, but verification requires live trial (docs are marketing, not technical specs).

**Sources:**
- Keitaro blog: "120+ network templates including AliExpress"
- Binom FAQ: "Almost all affiliate networks support postback... contact your affiliate network's customer support"
- AliExpress Portals help: Documents postback config but not tracker-specific

**Resolution:** **Trial required before commitment.** 14-day Keitaro trial + 30-day Binom trial both sufficient to test actual postback flow with real Portals credentials.

**Confidence:** 8/10 — marketing claims vs technical reality gap common in this industry

---

## Conflict 5: Amazon Associates — No S2S Postback

**Conflict:** Amazon doesn't offer traditional S2S postback; uses API (Creators API) for conversion reporting.

**Sources:**
- wecantrack: "Easy Affiliate connector runs through API... no Postback URL"
- RedTrack: "API conversion tracking... most reliable method"
- Amazon Associates docs: PA-API 5 deprecated, Creators API current

**Resolution:** **Separate API integration path needed for Amazon.** Not a postback endpoint. Our tracker must support both: inbound postback (AliExpress, CJ, Awin) AND outbound API polling (Amazon Creators API).

**Confidence:** 9/10 — confirmed by multiple integration platforms

---

## Conflict 6: Build Time Estimate (1-2 Weeks vs Reality)

**Conflict:** Internal tracker MVP estimated at 1-2 weeks, but postback template complexity unknown.

**Sources:**
- Our schema: 80% done (click_event, conversion_event, commission_record exist)
- ModuleContract: exists
- Missing: click endpoint, postback endpoint, EPC aggregation, admin UI, network templates

**Resolution:** **Buffer to 3 weeks.** Add 50% buffer for:
- Network template complexity (AliExpress param mapping)
- Idempotency edge cases (duplicate postbacks, race conditions)
- IP whitelist / HMAC per network
- Admin UI polish

**Confidence:** 7/10 — estimate based on schema completeness, but template work is unknown quantity

---

## Conflict 7: GDPR / Cookie Compliance for Click Tracking

**Conflict:** Click tracking requires client identifiers (cookies, fingerprinting, IP). GDPR/CCPA implications not fully analyzed.

**Sources:**
- SPEC-005 NFR-5: "no raw IP storage" — already in schema (ip_hash)
- SPEC-005: "requires a channel — without it EPC per channel is uncomputable"
- Keitaro/Binom: Handle compliance as part of platform

**Resolution:** **Document as gap (G-xx).** Need legal review before production. Current schema supports:
- IP hashing (not raw IP)
- Channel required (no anonymous tracking)
- No raw user identifiers in click_event
- But: cookie consent, legitimate interest assessment, DPA not done

**Confidence:** 6/10 — technical controls in place, legal review pending

---

## Conflict 8: Cloudflare Pages + Tracker VPS Latency

**Conflict:** Static site on Cloudflare Pages (global edge) + tracker on single VPS (e.g., Frankfurt) = added latency for click redirect.

**Sources:**
- SPEC-004: Static-first on Cloudflare Pages
- Keitaro/Binom: Self-hosted on single VPS
- Click redirect: Cloudflare edge → VPS → merchant

**Resolution:** **Acceptable for MVP.** Typical redirect latency <100ms. Can optimize later with:
- Cloudflare Workers for click tracking at edge
- Multiple tracker VPS in target GEOs
- Cloudflare Load Balancing

**Confidence:** 8/10 — standard architecture, known pattern

---

## Conflict 9: Postback IP Whitelisting with Cloudflare

**Conflict:** Networks require whitelisted IPs for postback. Cloudflare Pages IPs rotate; Cloudflare Workers IPs rotate.

**Sources:**
- Binom docs: "IP whitelisting — Tracking platform may require whitelisted server IPs"
- Affise: "Forgetting to whitelist after infrastructure changes"
- Cloudflare: Pages/Workers use shared IP pools

**Resolution:** **Use dedicated VPS for tracker (fixed IP).** Don't run postback endpoint on Cloudflare Pages/Workers. Keep tracker on Timeweb VPS with static IP. Click tracking can be on Cloudflare Workers later.

**Confidence:** 9/10 — standard practice, verified in Binom/Affise docs