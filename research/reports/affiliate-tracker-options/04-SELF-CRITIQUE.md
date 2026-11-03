# Self-Critique — Adversarial Pass

## 1. Claims with No Source

| Claim | Status |
|-------|--------|
| "Keitaro 14-day trial sufficient to validate AliExpress postback" | ⚠️ Based on trial length, not verified with actual Portals account |
| "Internal tracker MVP in 2 weeks" | ⚠️ Based on schema completeness (80%), not measured velocity |
| "UUID v7 collision negligible" | ✅ Measured: 128-bit, 1M/day → 10^-19 |
| "AGPL-3.0 blocks proprietary SaaS" | ✅ Verified: AGPL-3.0 Section 13 |
| "Open-source trackers are referral-program tools" | ✅ Verified by reading each README |

## 2. Sources That Disagree, Unreconciled

| Source A | Source B | Conflict | Resolution |
|----------|----------|----------|------------|
| Keitaro: "120+ network templates" | Binom FAQ: "Contact your affiliate network's customer support" | Template completeness | Trial both |
| AffEasy: "Unified Network Access" | No network list in README | Marketing vs reality | Excluded by AGPL |
| Keitaro: "14-day trial" | Binom: "30-day trial" | Trial length | Both sufficient |

## 3. Stale Sources

| Source | Date | Risk |
|--------|------|------|
| Some websearch results from 2024 | Pre-Keitaro 11 (2025) | Features may have changed |
| Binom v1 pricing referenced | Binom v2 current | v1 deprecated |
| Scaleo blog "2026-ready update" | June 2025 | May not reflect 2026 reality |

**Action:** All critical claims verified against current vendor sites (keitaro.io, binom.org, docs.binom.org) as of 2026-11-03.

## 4. Assumptions Presented as Facts

| Assumption | Reality Check |
|------------|---------------|
| "1-2 weeks internal build" | Based on schema completeness, not measured dev velocity. Buffered to 3 weeks. |
| "Keitaro trial validates AliExpress postback" | Requires live Portals account + real click. Not tested. |
| "Internal EPC matches Keitaro ±1%" | Assumes identical click counting logic. May differ on dedup rules. |
| "VPS $15/mo on Timeweb" | Based on Timeweb Cloud pricing page, not provisioned. |

## 5. Numbers Derived Instead of Measured

| Number | Source | Measured? |
|--------|--------|-----------|
| $15/mo VPS | Timeweb Cloud pricing page | ❌ Reported |
| $49/$99/mo tracker | Vendor pricing pages | ✅ Reported |
| 14/30 day trial | Vendor pricing pages | ✅ Reported |
| 2 weeks dev | Schema completeness (80%) | ❌ Derived |
| 50-150ms latency | Industry standard | ❌ Derived |

## 6. Questions Never Asked (Because Brief Implied Answer)

| Unasked Question | Why It Matters |
|------------------|----------------|
| **What if AliExpress Portals rejects our postback URL?** | No fallback — need Portals account first |
| **What if Keitaro trial data doesn't export cleanly?** | Migration script may fail — need export test in trial |
| **What if internal click counting differs from Keitaro?** | EPC mismatch → cutover fails — need parallel run criteria |
| **What about GDPR Article 25 (Data Protection by Design)?** | Legal review needed — technical controls only |
| **What if operator rejects $64 trial cost?** | Fallback: build-only (3 weeks to EPC, no paid traffic) |
| **What if Timeweb VPS in Russia has jurisdiction issues?** | Backup provider needed (Hetzner, DigitalOcean) |
| **How to handle network postback IP changes?** | Cloudflare Workers IPs rotate — keep postback on fixed VPS |

## 7. Commercial Blind Spots

| Blind Spot | Impact |
|-------------|--------|
| **Keitaro/Binom lock-in** | Export formats not tested; migration effort unknown |
| **Timeweb Cloud jurisdiction** | Russian company — data residency / sanctions risk |
| **AGPL-3.0 "service" definition** | If we host AffEasy fork internally, still AGPL? |
| **Operator's actual dev velocity** | 2 weeks assumed; could be 4 — affects hybrid timeline |
| **Paid traffic readiness** | D-020 blocks spend until EPC; organic-only may not generate enough clicks for statistical significance |

## 8. Legal Exposure Not Checked

| Area | Status |
|------|--------|
| AliExpress Portals API agreement | ❌ Not reviewed — need Portals account first |
| Alibaba.com B2B affiliate agreement | ❌ Not reviewed — Russian traffic blocked anyway |
| Amazon Creators API terms | ❌ Not reviewed |
| GDPR/CCPA for click_id cookies | ❌ Technical controls only, no legal review |
| AGPL-3.0 derivative work definition | ✅ Confirmed blocking for SaaS |
| VPS provider data processing agreement | ❌ Not reviewed (Timeweb Cloud) |

---

## Verdict Summary

| Category | Rating | Notes |
|----------|--------|-------|
| **Overall confidence** | 7.5/10 | Strong on commercial trackers, weak on untested assumptions |
| **Keitaro trial recommendation** | 9/10 | Low risk, high reward, validates critical path |
| **Internal build timeline** | 6/10 | Optimistic; buffered to 3 weeks |
| **Open-source exclusion** | 10/10 | Clear license + use-case mismatch |
| **Legal/compliance readiness** | 4/10 | Major gap — needs legal review before production |

---

## Action Items from Critique

1. [ ] **Legal review** of AliExpress Portals agreement before F015
2. [ ] **Test Keitaro export/import** during trial (not just postback)
3. [ ] **Define parallel-run success criteria** quantitatively (EPC ±1%, click count exact)
4. [ ] **Identify backup VPS provider** (Hetzner Falkenstein, ~€15/mo)
5. [ ] **Schedule legal review** for GDPR/click tracking before Phase 2 launch
6. [ ] **Document rollback plan** if internal build fails (extend Keitaro 1 month)