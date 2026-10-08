# AliExpress Affiliate API — Verified Parameter & Field Specification

**URLs fetched** (2026-10-08, HTTP 200, HTTP 200, HTTP 200):
- `http://open.alitrip.com/docs/api.htm?apiId=45794` — `aliexpress.affiliate.hotproduct.query` (77,869 b raw / 398 text lines)
- `http://open.alitrip.com/docs/api.htm?apiId=48598` — `aliexpress.affiliate.hotproduct.download` (71,745 b raw / 345 text lines)
- `https://openservice.aliexpress.com/doc/api.htm` — API Reference index (6,139 b, title only)

**Publisher**: Taobao Open Platform (Taobao开放平台), the official AliExpress
Open Platform documentation host.
**Classification**: **PRIMARY — official vendor API documentation**
**Confidence**: **8/10** for the parameter/field names below (captured verbatim
from the vendor's own doc site); **4/10** for anything not shown here.

---

## 🔑 G2 RESOLVED — the signing algorithm

The round-1 contradiction (MD5/HMAC vs HMAC-SHA256) is now settled. Verbatim from
the parameter list:

> 签名的摘要算法，可选值为：**hmac，md5**。
> ("Signature digest algorithm. Permitted values: **hmac, md5**.")

**There is no HMAC-SHA256.** The community SDK reporting "HMAC-SHA256" was either
implementing the *HMAC* construction differently, or was wrong. **Any prior art in
this repo that assumed SHA-256 is wrong and must be discarded.**

This is exactly the failure mode R2 exists to prevent: a plausible-but-wrong
algorithm would have produced opaque `IncompleteSignature` errors during
integration, with the real cause buried.

### Transport & protocol

| Property | Value |
|---|---|
| Endpoint | `http://gw.api.taobao.com/router/rest` |
| Secondary endpoint | `https://eco.taobao.com/router/rest` |
| Protocol | **TOP** (Taobao Open Protocol) |
| Protocol version | `2.0` |
| Response format | `xml` (default) or `json` |
| Slim JSON | supported when `format=json` |

---

## Common system parameters (verbatim)

| Param | Description (verbatim / translated) |
|---|---|
| `app_key` | TOP-allocated AppKey ("TOP分配给应用的AppKey") |
| `target_app_key` | Target AppKey — only relevant when calling a third-party ISV's API |
| `sign_method` | **`hmac` or `md5`** |
| `sign` | Signature of input parameters |
| `session` | Auth token issued by TOP after successful user authorisation |
| `timestamp` | `yyyy-MM-dd HH:mm:ss`, **timezone GMT+8** |
| `v` | `2.0` |
| `format` | `xml` or `json` |
| `is_zip_request` etc. | present in the doc |

⚠️ **Timestamp clock skew tolerance: 10 minutes** (verbatim: "淘宝API服务端允许
客户端请求最大时间误差为10分钟"). This is a hard operational constraint — clock
drift between our server and GMT+8 breaks authentication. NFR territory.

---

## ⭐ G7 RESOLVED — the bulk-download endpoint exists

`aliexpress.affiliate.hotproduct.download` returns bulk hot-product data with
**`promotion_link` included**, which the paginated `query` variant does not.

> `promotion_link` → `http://s.click.aliexpress.com/e/xxxxx`

**INFERENCE (high confidence):** the download endpoint is the one that carries
ready-made affiliate tracking links. If it can be fetched on a schedule, it
collapses a large part of the link-building work. **This should be the first
endpoint we integrate**, ahead of `hotproduct.query`.

---

## Complete endpoint list (11 affiliate endpoints, verbatim)

Captured from the doc site's navigation:

| # | Endpoint |
|---|---|
| 1 | `aliexpress.affiliate.hotproduct.query` |
| 2 | `aliexpress.affiliate.category.get` |
| 3 | `aliexpress.affiliate.product.query` |
| 4 | `aliexpress.affiliate.product.smartmatch` |
| 5 | `aliexpress.affiliate.productdetail.get` |
| 6 | `aliexpress.affiliate.featuredpromo.get` |
| 7 | `aliexpress.affiliate.featuredpromo.products.get` |
| 8 | `aliexpress.affiliate.hotproduct.download` |
| 9 | `aliexpress.affiliate.image.search` |
| 10 | `aliexpress.cutflow.test` |
| 11 | `aliexpress.affiliate.product.detail.get` (appears as `productdetail.get`) |

Plus auth endpoints (from round 1, `openservice.aliexpress.com`):
`/auth/token/create`, `/auth/token/refresh`, `/auth/token/security/create`,
`/auth/token/security/refresh`.

**INFERENCE:** `category.get` → category taxonomy; `product.smartmatch` →
**recommend/related products by category** (potentially the highest-value
discovery endpoint for offer selection); `image.search` → **image-based search**,
which is directly relevant to the dedup problem (Space 4 in
COMPETITIVE-LANDSCAPE); `cutflow.test` → a test endpoint, useful as a zero-cost
auth smoke test.

---

## ⭐⭐ G-CRITICAL — `ship_to_country` makes landed cost computable

**This is the most important field in the whole capture.**

> `ship_to_country` — 商品收货国家，**根据该国家税率政策返回对应商品价格**
> ("Product destination country. **Returns the corresponding product price
> according to that country's tax policy**.")

> `delivery_days` — 物流到达时间。3：3日达，5：5日达，7：7日达，10：10日达
> ("Logistics arrival time. 3: 3-day, 5: 5-day, 7: 7-day, 10: 10-day")

**This changes the product thesis.** Earlier analysis in
`COMPETITIVE-LANDSCAPE.md` rated "true landed cost" as the highest-value gap
while noting it was hard because duty is usually not exposed in feeds.

**The API exposes per-destination pricing under each country's tax policy.** So
the two hardest components of landed cost — destination-country pricing and
delivery time — are **available from the feed itself**, not modelled.

**Revised INFERENCE (much higher confidence than before):** landed cost is now a
high-confidence, low-risk product. It reduces to a lookup per
(country, product) rather than a customs simulation. This should be promoted in
priority. ⚠️ Still **not verified live** — it is documented behaviour, and the
first real API call must confirm what the response actually contains.

---

## Multi-currency & multi-language (verbatim)

**`target_currency` — 16 values:**
USD, GBP, CAD, EUR, UAH, MXN, TRY, RUB, BRL, AUD, INR, JPY, IDR, SEK, KRW

**`target_language` — 22 values:**
EN, RU, PT, ES, FR, ID, IT, TH, JA, AR, VI, TR, DE, HE, KO, NL, PL, MX, CL, IW, IN

**`platform_product_type`:** ALL, PLAZAZ, TMALL → corrected: `ALL, PLAZA, TMALL`

**`sort` field values:** SALE_PRICE_ASC, SALE_PRICE_DESC, DISCOUNT_ASC,
DISCOUNT_DESC, LAST_VOLUME_ASC, LAST_VOLUME_DESC

**Site identifier field:** `global, it_site, es_site, ru_site`
(verbatim: 站点商品标 = "site product flag")

**INFERENCE:** the API returns titles and prices **pre-localised** per
`target_language` and `target_currency`. That collapses a whole localisation layer
we had assumed we'd build ourselves, and it means the audience question
(global/English-first) is handled by a request parameter, not by translation
work. RU is even a first-class target language.

---

## Response fields — `TrafficProductResultDto` (verbatim)

| Field | Example / notes |
|---|---|
| `current_page_no` | pagination |
| `current_record_count` | pagination |
| `product_id` | e.g. `33006951782` |
| `product_title` | e.g. "Spring Autumn mother daughter dress matching family outfits…" |
| `product_detail_url` | `https://www.aliexpress.com/item/33006951782.html` |
| `product_main_image_url` | `https://ae01.alicdn.com/kf/…jpg` (CDN) |
| `product_small_image_urls` | CDN |
| `product_video_url` | CDN |
| **`commission_rate`** | **commission — the core economics field** |
| **`hot_product_commission_rate`** | **commission on Hot Products** |
| `original_price` / `original_price_currency` | pre-discount |
| `app_sale_price` / `app_sale_price_currency` | app price |
| `sale_price` | current price |
| **`target_app_sale_price`** | **price converted to `target_currency`** |
| `evaluate_rate` | rating |
| `lastest_volume` | sales volume (note vendor's spelling) |
| `first_level_category_id` / `_name` | e.g. "Women's Clothing" |
| `second_level_category_id` / `_name` | category tree |
| `platform_product_type` | ALL / PLAZA / TMALL |
| `shop_id` | e.g. `3255036` |
| **`promotion_link`** | `http://s.click.aliexpress.com/e/xxxxx` (download endpoint only) |
| `app_sale_price,shop_id` | composite filter param |

### Why these fields matter

| Field(s) | Decision it enables |
|---|---|
| `commission_rate` + `hot_product_commission_rate` | Offer ranking by margin. Resolves part of **G26**. We can filter to commission-eligible SKUs at ingest rather than storing dead weight. |
| `original_price` + `sale_price` | Fake-discount detection input. Together with price history → "is this discount real?" |
| `target_app_sale_price` + `ship_to_country` | Per-destination pricing → **landed cost** |
| `evaluate_rate` + `lastest_volume` | Quality/popularity filter; excludes junk listings |
| `product_main_image_url` (CDN) | Input to perceptual-hash dedup; cheap change-detection signal |
| `product_video_url` | Content asset for the site — free video per product |
| `first/second_level_category_*` | Category taxonomy → safety-critical exclusion list (D-012) enforced at ingest |

**INFERENCE (high confidence):** the combination of `original_price`,
`sale_price`, `evaluate_rate`, `lastest_volume`, `commission_rate`, and category
in a single record is *enough to build an offer-ranking function directly from
the feed* — which was the operator's "подбор офферов через LLM" idea. The data
needed for a deterministic ranker arrives with the product row. An LLM should
rank *narratives* (why this suits this audience); it should not be asked to
compute margins from numbers it can read.

---

## Still unverified (G3, G4 remain)

| # | Gap | Status |
|---|---|---|
| **G3** | Rate limits / daily quota | **NOT VERIFIED.** Round 1's "5,000 req/day" is from a single 2025 secondary source. Not confirmed by the vendor doc. |
| **G4** | Is a registered non-Chinese business eligible for an Affiliate API app? | **NOT VERIFIED.** The docs describe the protocol, not the eligibility policy. |
| G1 | Complete endpoint list | ✅ **RESOLVED** — 11 endpoints captured |
| G2 | Signing algorithm | ✅ **RESOLVED** — `hmac` or `md5`, **no SHA-256** |
| G7 | Bulk feed availability | ✅ **RESOLVED** — `hotproduct.download` exists, includes `promotion_link` |
| — | Landed-cost feasibility | ✅ **Largely resolved** via `ship_to_country` + `delivery_days` |
