# ADR-005: Tracker Selection — Keitaro Trial + Internal Build

**Date:** 2026-11-03
**Status:** Accepted
**Author:** Orchestrating agent
**Reviewers:** Operator (pending)

---

## Context

Issue #2 ("Decide analytics + click tracking") blocks:
- F023: Traffic/channel analytics + EPC
- F026: First affiliate click recorded end-to-end
- F027: First real commission (north star)

D-020 forbids paid traffic spend without EPC data. We need click→conversion tracking **now** to measure organic EPC and unblock paid traffic decisions.

---

## Decision

**Approve Hybrid Approach:**
1. **Week 1-2:** Keitaro Starter 14-day trial ($49 + $15 VPS = $64) on Timeweb Cloud
2. **Week 2-4:** Build internal tracker MVP (our stack, existing schema)
3. **Week 5:** Cutover — verify EPC match, cancel Keitaro, run internal only

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Keitaro only** | Fastest EPC, proven templates, vendor maintenance | $64/mo recurring, limited customization, lock-in | Rejected — recurring cost |
| **Binom only** | Fixed price, unlimited domains/users, free install | $99/mo entry, higher trial cost | Rejected — higher entry cost |
| **Build only** | Zero recurring, full control, MIT license | 2-3 weeks to first EPC, D-020 blocks traffic until done | Rejected — too slow |
| **Open-source (AffEasy/Refearn/Cliq)** | Free, MIT/AGPL | Wrong category (referral programs), AGPL-3.0 viral, no AliExpress templates, alpha | Rejected — wrong use case + license |
| **Hybrid (Keitaro trial → Internal)** | Fast EPC + zero recurring + full control | 3-week overlap cost ($64 + dev) | **ACCEPTED** |

---

## Consequences

### Positive
- **EPC measurement in 1-2 days** (Keitaro trial) — unblocks D-020 immediately
- **Zero recurring cost after Week 5** — internal tracker owned, MIT licensed
- **Full customization** — ModuleContract integration, custom postback logic, EPC aggregation
- **Risk mitigation** — Keitaro validates AliExpress/Alibaba postback params before we build
- **Data ownership** — All clicks/conversions in our DB from Day 1 (Keitaro exports + internal capture)

### Negative
- **3-week overlap cost:** ~$64 + ~2 weeks dev time
- **Migration effort:** Export/import Keitaro data, verify EPC match
- **Dual maintenance for ~1 week:** Run both in parallel for validation

### Risks Accepted
1. **Keitaro AliExpress template may not work** — mitigated by 14-day trial validation
2. **Internal build exceeds 2 weeks** — buffered to 3 weeks; Keitaro can extend 1 month
3. **GDPR legal review pending** — technical controls in schema (ip_hash, channel required); legal review before production launch
4. **Cloudflare Pages + VPS latency** — accepted for MVP; optimize with Workers later

---

## Implementation Plan

### Week 1 (Keitaro Trial)
- [ ] Provision Timeweb Cloud VPS (2CPU/4GB/50GB SSD, ~$15/mo, ref `?i=35886`)
- [ ] Install Keitaro (1-click script)
- [ ] Configure AliExpress Portals postback → test click→conversion
- [ ] Configure Alibaba B2B postback → test
- [ ] Add CJ/Awin templates for future
- [ ] Document exact postback param mappings

### Week 2-4 (Internal Build)
- [ ] Click endpoint (`/click`) — UUID v7 click_id, click_event store, redirect
- [ ] Postback endpoint (`/postback/:network`) — validation, conversion_event, idempotency
- [ ] EPC aggregation view + API
- [ ] Admin UI (campaigns, templates, logs, EPC dashboard)
- [ ] AliExpress/Alibaba postback templates (from Keitaro-validated params)
- [ ] Migration script (Keitaro export → internal import)

### Week 5 (Cutover)
- [ ] Run both 48h parallel
- [ ] Compare EPC/clicks (must match ±1%)
- [ ] Switch traffic to internal
- [ ] Cancel Keitaro subscription
- [ ] Document lessons learned

---

## Verification Criteria

| Metric | Target |
|--------|--------|
| Keitaro trial EPC measured | ✅ Organic EPC > $0 by Day 3 |
| Internal EPC matches Keitaro | ±1% for 48h |
| Postback success rate | >99.9% |
| Click→redirect latency | <200ms added |
| Migration data fidelity | 100% click/conversion count match |

---

## Related

- Issue #2: Decide analytics + click tracking
- Issue #1: AliExpress API credentials (parallel — needed for F015 live module)
- Issue #8: GitHub Actions billing (CI for internal tracker)
- SPEC-005: Click/conversion/commission schema
- ModuleContract: Pluggable tracker as source