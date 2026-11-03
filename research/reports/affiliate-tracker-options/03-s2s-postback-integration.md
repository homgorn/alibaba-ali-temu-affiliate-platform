# S2S Postback Integration — Network Details

## AliExpress (Portals)

**Source:** ads.alibaba.com/help/getcode.htm, wecantrack.com/aliexpress-integration, guides.freshstore.com
**Retrieved:** 2026-11-03
**Type:** reported (official help centers + integration guides)

### Authentication
Three items from **same Portals account**:
1. **Tracking ID** — short name (e.g., `default`, `mystore`), NOT a link
2. **Keystring** (App Key / API Key)
3. **App Secret** (API Secret)

### Tracking Link Format
```
http://click.alibaba.com/rd/InMw9Ka?pid={pubid}&tp1={clickid}&...
```
- `pid` = publisher/sub-id
- `tp1` = click ID (unique per click)

### Postback Configuration
**Location:** `https://ads.alibaba.com/postbackUrl.htm` (Alibaba B2B) or Portals dashboard (AliExpress)

**Example Postback URL:**
```
https://your-server/postback?pubid={pid}&clickid={tp1}&commission={est_com}&source=alibaba
```

**Available Parameters:**
| Placeholder | Description |
|-------------|-------------|
| `{pid}` | Your sub-publisher ID from tracking link |
| `{tp1}` | Your unique click ID / transaction ID |
| `{ord_id}` | Order ID |
| `{est_com}` | Estimated commission |

**Cookie Window:** 60 days after click.

### Integration Notes (from wecantrack)
1. Generate postback URL in wecantrack (or your tracker)
2. Place in AliExpress Portals account
3. SubID parameter configurable in Portals
4. Postback fires on confirmed order (seller confirms + user pays)

---

## Alibaba.com B2B

**Source:** ads.alibaba.com/help/getcode.htm
**Retrieved:** 2026-11-03
**Type:** reported (official help center)

### Postback Config
**URL:** `https://ads.alibaba.com/postbackUrl.htm`

**Example:**
```
https://www.your-server-url?pubid={pid}&clickid={tp1}&commission={est_com}&source=alibaba
```

**Parameters:**
| Placeholder | Description |
|-------------|-------------|
| `{pid}` | Sub-publisher ID from tracking link |
| `{tp1}` | Unique click ID / transaction ID |
| `{ord_id}` | Order ID |
| `{est_com}` | Estimated commission |

**Cookie Window:** 60 days.

**Caveats:**
- **Refuses Russian traffic** — B2B affiliate program blocks RU
- **Blocks MMP attribution** — no mobile measurement partner support
- **High-ticket, late-paying** — deferred per D-009

---

## Amazon Associates / Creators API

**Source:** wecantrack.com/easy-affiliate-integration, Amazon Associates docs
**Retrieved:** 2026-11-03
**Type:** reported (integration platforms + Amazon docs)

### Tracking
- **No traditional S2S postback** from Amazon to tracker
- **SubID in links:** `tag=yourtag-20&subId=click123`
- **Reporting:** Via API (PA-API 5 deprecated → Creators API)
- **Creators API:** Access tokens, user IDs, advertiser domain → conversions flow via API

### Integration (wecantrack)
- Connect via Access Token + User IDs + Advertiser Domain
- Conversions flow via API (not postback)
- SubID selector configurable

**Implication:** Need API integration, not postback endpoint. Different architecture.

---

## CJ Affiliate / Awin / Impact / Rakuten / Partnerize

**Source:** wecantrack.com integrations, redtrack.io, affise.com
**Retrieved:** 2026-11-03
**Type:** reported (integration platforms + network docs)

### Common Patterns
| Network | Postback | API | Template in Keitaro/Binom |
|---------|----------|-----|---------------------------|
| CJ Affiliate | ✅ | ✅ (deep link, commission detail) | ✅ |
| Awin | ✅ | ✅ | ✅ |
| Impact | ✅ | ✅ | ✅ |
| Rakuten | ✅ | ✅ (Postback API beta) | ✅ |
| Partnerize | ✅ | ✅ | ✅ |
| Tradedoubler | ✅ | ✅ | ✅ |
| Admitad | ✅ | ✅ | ✅ |

### Postback Parameters (Standard)
| Parameter | Description | Example |
|-----------|-------------|---------|
| `click_id` / `cid` / `clickid` | Unique click identifier | `abc123` |
| `sub1`-`sub5` | Custom sub-IDs | `campaign_spring` |
| `payout` / `commission` | Commission amount | `25.50` |
| `currency` | ISO-4217 | `USD` |
| `status` / `cnv_status` | Conversion status | `confirmed`, `pending` |
| `order_id` / `ord_id` | Merchant order ID | `ORD-12345` |
| `conversion_type` | `sale`, `lead`, `install` | `sale` |

---

## S2S Postback Architecture (General)

**Source:** track360.io, anytrack.io, redtrack.io
**Retrieved:** 2026-11-03
**Type:** reported (educational resources)

### Flow
```
1. User clicks affiliate link → tracking platform generates click_id
2. click_id passed to merchant via subID parameter (sub1=click_id)
3. User converts on merchant site
4. Merchant backend fires HTTP request to tracking platform postback URL
5. Tracking platform matches click_id → attributes conversion → calculates commission
```

### Postback URL Structure (Best Practice)
```
https://tracker.domain/postback?
  click_id={click_id}&
  payout={commission}&
  currency={currency}&
  status={status}&
  order_id={order_id}&
  sub1={sub1}&sub2={sub2}&...
  customer_id={customer_id}&
  timestamp={unix_ts}
```

### Key Requirements
1. **IP Whitelisting** — Tracking platform may require whitelisted server IPs
2. **HTTPS Required** — Most networks require TLS
3. **Idempotency** — Handle duplicate postbacks (same click_id + order_id)
4. **Response** — Return 2xx within timeout (typically 5-30s)
5. **Retry Logic** — Networks retry on non-2xx (exponential backoff)

---

## Our Implementation Requirements

### Click Endpoint (Inbound)
```
GET /click?affiliate_id=&campaign_id=&sub1=&sub2=&sub3=&sub4=&sub5=
→ Generates click_id (UUID)
→ Stores click_event (click_id, affiliate_id, campaign_id, sub1-5, ip_hash, user_agent, channel, timestamp)
→ Redirects to merchant URL with sub1=click_id
```

### Postback Endpoint (Inbound from Network)
```
GET /postback?click_id=&payout=&currency=&status=&order_id=&sub1=&sub2=...
→ Validates click_id exists in click_event
→ Creates/updates conversion_event (click_event_id, network_report_id, status, amount_minor, currency)
→ If status=confirmed → creates commission_record
→ Returns 200 OK
```

### Outbound Postback (To Partners — Future)
```
POST https://partner.domain/postback?
  click_id={our_click_id}&
  commission={amount}&
  currency={currency}&
  status={status}&
  sub1={our_sub1}&...
```

---

## Network-Specific Config for Our Tracker

| Network | Click Param for click_id | Postback URL Template | Auth |
|---------|-------------------------|----------------------|------|
| AliExpress | `tp1` | `/postback/aliexpress?click_id={tp1}&commission={est_com}&order_id={ord_id}` | Portals credentials |
| Alibaba B2B | `tp1` | `/postback/alibaba?click_id={tp1}&commission={est_com}&order_id={ord_id}` | ads.alibaba.com |
| CJ Affiliate | `sid` | `/postback/cj?click_id={sid}&commission={commission}&status={status}` | API key |
| Awin | `awc` | `/postback/awin?click_id={awc}&amount={amount}&currency={currency}` | API key |
| Impact | `subId1` | `/postback/impact?click_id={subId1}&payout={Payout}&status={EventStatus}` | API key |

---

## Testing Checklist

- [ ] Click → click_id stored → redirect works
- [ ] Postback with valid click_id → conversion_event created
- [ ] Postback with invalid click_id → 400, no conversion
- [ ] Duplicate postback (same click_id + order_id) → idempotent
- [ ] Postback with wrong signature → 401/403
- [ ] Network retry on 5xx → eventual success
- [ ] IP whitelist enforced
- [ ] HTTPS enforced