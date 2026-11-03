# Build vs Buy vs Hybrid — Decision Analysis

## Decision Context

**Goal:** Unblock F023 (traffic/channel analytics + EPC) → F026 (first click) → F027 (first commission)
**Constraint:** D-020 forbids paid traffic spend without EPC data
**Current state:** Schema ready (click_event, conversion_event, commission_record), ModuleContract exists, 0 tracking code

---

## Option Comparison

| Criterion | Keitaro Starter | Binom v2 | Build Internal (MVP) | Hybrid (Keitaro + Build) |
|-----------|-----------------|----------|----------------------|--------------------------|
| **Time to first EPC** | 1-2 days (trial) | 1-2 days (trial) | 1-2 weeks | 1-2 days (Keitaro) + 1-2 weeks (build) |
| **Monthly cost** | $49 + $15 VPS = $64 | $99 + $15 VPS = $114 | $15 VPS + dev time | $64 + dev time |
| **AliExpress postback** | Template exists (verify in trial) | Template exists (verify in trial) | Must build from docs | Keitaro validates, then replicate |
| **Alibaba B2B postback** | Template exists | Template exists | Must build | Keitaro validates |
| **Amazon integration** | API only (no postback) | API only | API only | Same |
| **CJ/Awin/Impact** | Templates exist | Templates exist | Must build templates | Keitaro validates |
| **Data ownership** | Your VPS | Your VPS | Your DB | Both |
| **Customization** | Limited (UI config) | Limited (UI config) | **Unlimited** | Full for internal |
| **Lock-in risk** | Medium (export CSV/API) | Medium (export CSV/API) | **None** | Low (Keitaro for validation only) |
| **AGPL risk** | None (proprietary) | None | None (MIT) | None |
| **Maintenance** | Vendor updates | Vendor updates | **Our responsibility** | Shared |
| **Team/users** | 1 user (Starter) | Unlimited | Unlimited | Unlimited internal |

---

## Cost Projection (12 Months)

| Scenario | Month 1-3 | Month 4-12 | Total Year 1 |
|----------|-----------|------------|--------------|
| **Keitaro only** | $64 × 3 = $192 | $64 × 9 = $576 | **$768** |
| **Binom only** | $114 × 3 = $342 | $114 × 9 = $1,026 | **$1,368** |
| **Build only** | $15 VPS × 3 + dev = ~$2,000 | $15 × 9 = $135 | **~$2,135** |
| **Hybrid (Keitaro 3mo → Internal)** | $64 × 3 + dev = ~$2,192 | $15 × 9 = $135 | **~$2,327** |

**Key insight:** Commercial tracker pays for itself in **time-to-EPC**. 2 weeks of dev time ≈ $2,000+ at any reasonable rate. Keitaro trial gives EPC data **today**.

---

## Risk Assessment

| Risk | Keitaro | Binom | Build | Hybrid |
|------|---------|-------|-------|--------|
| AliExpress template broken | Medium (trial validates) | Medium | N/A (build from docs) | Low (Keitaro validates first) |
| Vendor lock-in | Medium | Medium | **None** | Low (3mo max) |
| Vendor shutdown | Low (est. 2012) | Low (est. 2015) | N/A | Low |
| Price increase | Possible | Possible | **No** | 3mo exposure |
| Maintenance burden | Vendor | Vendor | **High (us)** | Medium |
| GDPR/privacy compliance | Vendor helps | Vendor helps | **Our responsibility** | Shared |
| Team scaling cost | +$40-200/mo | $0 (unlimited) | $0 | $0 internal |

---

## Recommended Path: Hybrid (Keitaro Trial → Internal Build)

### Phase 1: Week 1-2 — Keitaro 14-Day Trial
1. Provision VPS (Timeweb Cloud, 2CPU/4GB/50GB SSD, ~$15/mo)
2. Install Keitaro (1-click script)
3. Configure AliExpress Portals postback → test with real click
4. Configure Alibaba B2B postback → test
5. Add CJ/Awin templates for future
6. **Measure:** First real EPC data, click→conversion funnel

**Exit criteria:** EPC > $0 confirmed, postback working reliably.

### Phase 2: Week 2-4 — Internal Tracker MVP
**Stack:** Our existing Next.js + SQLite/Postgres + ModuleContract
**Schema:** Already exists (click_event, conversion_event, commission_record, click_id UUID)

**Components:**
1. **Click endpoint** (`/click`) — 2 days
   - Generate click_id (UUID v7)
   - Store click_event with sub1-sub5, channel, ip_hash, user_agent
   - Redirect to merchant with sub1=click_id

2. **Postback endpoint** (`/postback`) — 2 days
   - Validate click_id exists
   - Create conversion_event (status: pending/confirmed/rejected)
   - Idempotency on (click_id, order_id)
   - IP whitelist per network

3. **EPC Aggregation** — 1 day
   - SQL view: `SELECT channel, SUM(amount)/COUNT(*) as EPC FROM ... GROUP BY channel`
   - API endpoint for dashboard

4. **Admin UI** — 3 days
   - Campaign/offer CRUD
   - Postback template management
   - Click/conversion logs
   - EPC by channel/dashboard

5. **AliExpress/Alibaba Templates** — 2 days
   - Port click_id param mapping (tp1, pid)
   - Postback URL generation per network
   - Test with Keitaro-validated params

5. **Migration Script** — 1 day
   - Export Keitaro clicks/conversions → import to internal
   - Verify EPC matches

**Total: ~11 dev days (2 weeks)**

### Phase 3: Week 5 — Cutover
1. Run both in parallel 48h
2. Compare EPC/click counts (must match within 1%)
3. Switch DNS/traffic to internal
4. Cancel Keitaro subscription
5. Document lessons learned

---

## Internal Tracker Technical Spec (MVP)

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/click` | GET | Inbound click tracking → redirect |
| `/postback/:network` | GET | Inbound postback from network |
| `/api/epc` | GET | EPC by channel/date range |
| `/api/clicks` | GET | Click log with filters |
| `/api/conversions` | GET | Conversion log with filters |
| `/admin/campaigns` | CRUD | Campaign/offer management |
| `/admin/postback-templates` | CRUD | Network postback config |

### Database (Already Exists)

```sql
-- click_event (SPEC-005)
click_id UUID PK
affiliate_id FK
campaign_id FK
sub1-sub5 TEXT
channel TEXT -- 'organic', 'telegram', 'seo', 'paid_google', etc.
ip_hash TEXT -- SPEC-005 NFR-5: no raw IP
user_agent TEXT
timestamp TIMESTAMPTZ
source TEXT -- 'keitaro', 'internal', 'manual'

-- conversion_event (SPEC-005)
conversion_id UUID PK
click_event_id FK
network_report_id TEXT -- network's order ID
status TEXT -- 'pending', 'confirmed', 'rejected', 'reversed'
amount_minor INTEGER -- SPEC-003 FR-3: integer minor units
currency CHAR(3)
status_changed_at TIMESTAMPTZ
source TEXT

-- commission_record (SPEC-005)
commission_id UUID PK
conversion_event_id FK
amount_minor INTEGER
currency CHAR(3)
reconciled BOOLEAN
reconciled_at TIMESTAMPTZ
payout_batch_id UUID
```

### Security (SPEC-005 NFR-5 + R-020)
- **No raw IP storage** — hash with salt (already in schema)
- **Postback IP whitelist** — per network config
- **Rate limiting** — 100 req/min per IP on `/click`, 50/min on `/postback`
- **HMAC signature** — optional per network config
- **Audit log** — all postback attempts logged (success/fail)

---

## Decision Matrix for Operator

| Question | Answer |
|----------|--------|
| **Approve Keitaro trial ($64/mo incl VPS)?** | **YES** — unblocks EPC measurement today |
| **Approve 2-week internal build sprint?** | **YES** — eliminates $64/mo recurring, full control |
| **Target cutover date?** | **Week 5** (3 weeks from now) |
| **Success metric?** | Internal EPC matches Keitaro within 1% for 48h |

---

## If Operator Rejects Hybrid

### Fallback: Keitaro Only (Short Term)
- Continue Keitaro Starter ($49/mo)
- Build internal when dev bandwidth available
- **Risk:** $64/mo indefinite, no custom features

### Fallback: Build Only (No Commercial)
- 2-3 weeks to first EPC (vs 2 days)
- **Risk:** D-020 forbids traffic spend until EPC known — organic only until done
- **Cost:** ~$2,000 dev time vs $192 for 3mo Keitaro

---

## Recommendation

**Approve Hybrid.** Lowest risk, fastest EPC, eliminates recurring cost in 3 weeks. Keitaro trial cost ($64) is negligible vs dev time value. Internal build uses existing schema/architecture — not a rewrite.