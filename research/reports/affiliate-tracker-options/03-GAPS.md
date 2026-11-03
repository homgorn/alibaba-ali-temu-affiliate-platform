# Gaps — What Could Not Be Determined

## G-01: Exact AliExpress Portals Postback Parameter Completeness
**What:** Full list of supported postback parameters in AliExpress Portals
**Where looked:** ads.alibaba.com/help/getcode.htm, wecantrack.com/aliexpress-integration, Portals dashboard screenshots
**Gap:** Docs show `{pid}`, `{tp1}`, `{ord_id}`, `{est_com}` but don't confirm if `{currency}`, `{status}`, `{sub2}-{sub5}` supported
**Impact:** Postback endpoint may miss data fields
**Mitigation:** Test in Keitaro trial with real Portals account

## G-02: Alibaba.com B2B Postback Parameter Completeness
**What:** Full parameter list for ads.alibaba.com/postbackUrl.htm
**Where looked:** ads.alibaba.com/help/getcode.htm
**Gap:** Only example shows `{pid}`, `{tp1}`, `{est_com}`, `{ord_id}`. No confirmation of optional params.
**Impact:** Same as G-01
**Mitigation:** Test in trial

## G-03: Keitaro/Binom AliExpress Template Actual Coverage
**What:** Whether "template" means full param mapping or just basic click_id
**Where looked:** Keitaro blog, Binom FAQ, docs.binom.org/postback-v2.php
**Gap:** Marketing says "template exists" but doesn't show param mapping
**Impact:** May need manual config anyway
**Mitigation:** Trial test — create offer with AliExpress template, inspect generated postback URL

## G-04: Amazon Creators API Conversion Reporting Latency
**What:** How fast conversions appear via API vs real-time postback
**Where looked:** wecantrack, RedTrack, Amazon Creators API docs
**Gap:** API polling interval, data freshness, historical backfill capability
**Impact:** EPC calculation lag for Amazon traffic
**Mitigation:** Document as known limitation; poll every 15-60 min

## G-05: Internal Tracker Postback Template Development Effort
**What:** Exact dev days to build AliExpress/Alibaba/CJ/Awin postback templates
**Where looked:** Binom postback-v2.php, Keitaro Admin API docs, network docs
**Gap:** Param mapping complexity unknown until tested
**Estimate:** 2 days per network (optimistic) → 4-6 days (realistic)
**Impact:** Build timeline uncertainty
**Mitigation:** Spike in Week 1 — build AliExpress template first, measure actual time

## G-06: Click ID Collision Probability (UUID v7)
**What:** Collision risk for 128-bit UUID v7 at projected scale
**Where looked:** UUID v7 spec, Binom click_id format (alphanumeric), Keitaro click_id
**Gap:** No empirical data at our projected scale (100K-1M clicks/day)
**Assessment:** UUID v7 (time-ordered, 128-bit) — collision probability ~10^-19 at 1M/day. Negligible.
**Gap closed:** Acceptable risk.

## G-07: Postback Duplicate Detection Edge Cases
**What:** Exact duplicate criteria — (click_id, order_id) vs (click_id, timestamp, amount)
**Where looked:** Binom postback-v2.php ("cnv_id — parameter to send clickid"), Affise duplicate logic
**Gap:** Networks vary: some send same order_id with different status updates (pending→confirmed)
**Decision:** Dedup on (click_id, network_report_id, status). Allow status transitions.

## G-08: GDPR/CCPA Compliance for Click Tracking
**What:** Legal basis for click_id cookies, IP hashing, channel tracking
**Where looked:** SPEC-005 NFR-5 (no raw IP, channel required), GDPR Art. 6, ePrivacy Directive
**Gap:** No legal review completed. Technical controls exist (ip_hash, channel required).
**Risk:** Medium — need legal sign-off before production
**Mitigation:** Document as blocker for Phase 2 production launch

## G-09: Cloudflare Pages + Tracker VPS Latency Impact on Conversion
**What:** Added redirect latency (Cloudflare edge → VPS → merchant) effect on conversion rate
**Where looked:** Cloudflare edge locations, typical VPS ping times
**Gap:** No A/B data for our specific GEOs
**Assessment:** Typical added latency 50-150ms. Industry standard accepts <200ms added redirect.
**Mitigation:** Monitor in Phase 1; optimize with Cloudflare Workers if >5% drop

## G-10: Postback IP Whitelisting with Cloudflare Workers (Future)
**What:** If we move click tracking to Cloudflare Workers, IPs rotate — breaks network IP whitelists
**Where looked:** Cloudflare Workers IP ranges, Binom/Affise IP whitelist docs
**Gap:** No solution for Workers + IP whitelist coexistence
**Decision:** Keep postback endpoint on fixed-IP VPS. Workers only for click tracking (outbound redirect).

## G-11: Internal Tracker Migration Data Fidelity
**What:** Can Keitaro export full click/conversion history for import?
**Where looked:** Keitaro Admin API (reports export), Binom API v1 (reports)
**Gap:** Export format, completeness, click_id format compatibility
**Mitigation:** Test export in trial; build flexible importer (CSV/JSON)

## G-12: Network Retry Behavior on Postback Failure
**What:** Exact retry policies (intervals, max attempts, backoff) per network
**Where looked:** Affise (exponential backoff), RedTrack, AnyTrack
**Gap:** No standardized spec. Each network different.
**Decision:** Implement idempotency + 200 OK for all valid postbacks. Log failures for manual replay.

## G-13: Commission Reconciliation Automation Level
**What:** How much of F027 (commission reconciliation) can be automated vs manual
**Where looked:** SPEC-005 (commission_record.reconciled, payout_batch_id), network dashboards
**Gap:** Networks vary: some have API for payout reports, some only CSV download
**Decision:** Phase 1 = manual CSV upload + matching. Phase 2 = API where available.

## G-14: EPC Statistical Significance Threshold
**What:** Minimum clicks/conversions for reliable EPC per channel
**Where looked:** Statistical power analysis, industry practice
**Gap:** No project-specific threshold defined
**Decision:** Start with 100 clicks / 5 conversions minimum per channel before using EPC for decisions

## G-15: VPS Provider Reliability (Timeweb vs Alternatives)
**What:** Timeweb Cloud uptime, support quality, Russian jurisdiction risk
**Where looked:** Timeweb Cloud site, myreviews.dev (referral `?i=35886`)
**Gap:** No independent uptime monitoring data
**Mitigation:** Use referral link (`https://timeweb.cloud/?i=35886`) for tracking; have backup VPS provider (Hetzner, DigitalOcean) documented

## G-16: Keitaro Trial → Paid Conversion Friction
**What:** Whether trial data/settings transfer seamlessly to paid plan
**Where looked:** Keitaro FAQ ("After switching to new plan, you will no longer have access to get back your old one")
**Gap:** Trial data migration not explicitly documented
**Mitigation:** Export trial data before trial ends; test import to fresh paid install

## G-17: Binom Cloud vs Self-Hosted Feature Parity
**What:** Whether Binom Cloud ($149/mo) has exact same features as self-hosted
**Where looked:** Binom pricing page ("Cloud tariffs... include server, monitoring, optimization")
**Gap:** "Optimization" — unclear if includes auto-bid rules, AI features
**Mitigation:** Not relevant if choosing Keitaro; document for future eval

## G-18: RefearnApp/AffEasy "Unified Network Access" Reality
**What:** Whether AffEasy truly supports "every major affiliate network" for link creation
**Where looked:** AffEasy README ("Unified Network Access"), GitHub repo packages/
**Gap:** No network list in README. AGPL-3.0 makes it moot anyway.
**Decision:** Irrelevant — license blocks use.

## G-19: Click ID Format Compatibility (Keitaro → Internal)
**What:** Whether Keitaro click_id format is importable to our UUID v7 schema
**Where looked:** Keitaro click_id format (alphanumeric, e.g., `abc123`), our UUID v7
**Gap:** Format mismatch — need mapping table or prefix strategy
**Decision:** Store original click_id as `external_click_id` TEXT, generate internal UUID v7

## G-20: Commission Rate Drift Detection
**What:** How to detect when network changes commission rate without notification
**Where looked:** SPEC-005 (commission_record), Binom cost update API
**Gap:** No automated drift detection designed
**Decision:** Phase 1 = manual review weekly. Phase 2 = automated comparison (stored rate vs postback rate)