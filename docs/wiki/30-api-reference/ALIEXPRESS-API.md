# AliExpress Affiliate API — Verified Spec

> **Summary:** The full affiliate API surface was captured verbatim from
> `open.alitrip.com` (Taobao Open Platform) on 2026-10-08. **11 affiliate
> endpoints, TOP protocol, gateway `gw.api.taobao.com/router/rest`, signing via
> `hmac` or `md5` only — there is no HMAC-SHA256.** Three business-critical
> findings: a **bulk download endpoint that includes `promotion_link`**, a
> **`ship_to_country` parameter that returns destination-country pricing under
> that country's tax policy** (making landed cost a lookup, not a simulation), and
> **per-language/per-currency titles and prices in the feed itself**.
>
> Confidence: **8/10** for parameter and field names (vendor's own docs,
> verbatim); **4/10** for anything not shown there.

## 🔑 The signing conflict is resolved

Round 1 found sources contradicting each other. The vendor doc settles it:

> 签名的摘要算法，可选值为：**hmac，md5**。
> ("Signature digest algorithm. Permitted values: **hmac, md5**.")

**There is no HMAC-SHA256.** Community SDKs claiming SHA-256 were wrong. This is
precisely the failure R2 exists to prevent — that guess would have produced
opaque `IncompleteSignature` errors during integration.

| Property | Value |
|---|---|
| Gateway | `http://gw.api.taobao.com/router/rest` |
| Secondary | `https://eco.taobao.com/router/rest` |
| Protocol | **TOP** (Taobao Open Protocol), version `2.0` |
| Format | `xml` default, `json` supported (slim JSON available) |
| Auth | `app_key`, `sign`, `session`, `timestamp` |
| **Timestamp** | `yyyy-MM-dd HH:mm:ss`, **GMT+8** |

⚠️ **Clock-skew tolerance is 10 minutes** (verbatim: 淘宝API服务端允许客户端请求
最大时间误差为10分钟). A hard operational NFR — clock drift from GMT+8 breaks auth.

## All 11 affiliate endpoints

| Endpoint | Purpose |
|---|---|
| `aliexpress.affiliate.hotproduct.query` | Paginated hot products |
| `aliexpress.affiliate.hotproduct.download` | **Bulk download — includes `promotion_link`** |
| `aliexpress.affiliate.category.get` | Category taxonomy |
| `aliexpress.affiliate.product.query` | Product search |
| `aliexpress.affiliate.product.smartmatch` | **Related-product recommendation** |
| `aliexpress.affiliate.productdetail.get` | Single product detail |
| `aliexpress.affiliate.featuredpromo.get` | Featured promotions |
| `aliexpress.affiliate.featuredpromo.products.get` | Promotion products |
| `aliexpress.affiliate.image.search` | **Image-based search** — input to dedup |
| `aliexpress.cutflow.test` | Test endpoint — **zero-cost auth smoke test** |

Auth: `/auth/token/create`, `/auth/token/refresh`, `/auth/token/security/create`,
`/auth/token/security/refresh`.

**Integration order (INFERENCE):** `cutflow.test` to prove auth at zero cost →
`hotproduct.download` for the bulk feed → `category.get` for taxonomy and the
safety-exclusion list → `smartmatch` for discovery → `product.query` for
on-demand search.

## ⭐⭐ Landed cost is now a lookup, not a simulation

The single most consequential field in the capture:

> `ship_to_country` — 商品收货国家，**根据该国家税率政策返回对应商品价格**
> ("Destination country. **Returns the corresponding product price according to
> that country's tax policy**.")

> `delivery_days` — 物流到达时间。3：3日达，5：5日达，7：7日达，10：10日达

**This revises the product thesis.** [COMPETITIVE-LANDSCAPE](../60-product-synthesis/COMPETITIVE-LANDSCAPE.md)
rated landed cost the top gap but flagged it risky because duty usually isn't in
feeds. **The API exposes per-destination pricing under each country's tax policy.**

Landed cost reduces to a lookup on `(product, destination_country)` plus a
delivery-time bucket — not a customs simulation. **Promote in priority.** ⚠️
Still **unverified live**: documented behaviour, and the first real call must
confirm what the response actually contains.

## Localisation arrives in the feed — no translation layer needed

**`target_currency`** (16): USD GBP CAD EUR UAH MXN TRY RUB BRL AUD INR JPY IDR
SEK KRW

**`target_language`** (22): EN **RU** PT ES FR ID IT TH JA AR VI TR DE HE KO NL PL
MX CL IW IN

**INFERENCE (high confidence):** titles and prices are returned **pre-localised**
per those parameters. That removes an entire localisation layer we assumed we'd
build, and it makes the global/English-first audience decision a request parameter
rather than a translation project. RU is a first-class target language.

Site identifier: `global, it_site, es_site, ru_site`.

## Response fields — `TrafficProductResultDto`

| Field | Notes |
|---|---|
| `product_id` | e.g. `33006951782` |
| `product_title` | localised per `target_language` |
| `product_detail_url` | `https://www.aliexpress.com/item/33006951782.html` |
| `product_main_image_url` | **CDN** — dedup input + cheap change signal |
| `product_small_image_urls`, `product_video_url` | CDN. **Free video asset per product** |
| **`commission_rate`** | **core economics** |
| **`hot_product_commission_rate`** | Hot Products commission |
| `original_price` (+`_currency`) | fake-discount input |
| `sale_price`, `app_sale_price` (+`_currency`) | current price |
| **`target_app_sale_price`** | converted to `target_currency` |
| `evaluate_rate` | rating |
| `lastest_volume` | sales volume (vendor's spelling) |
| `first_level_category_id/_name`, `second_level_category_id/_name` | taxonomy → safety exclusion (D-012) |
| `platform_product_type` | `ALL, PLAZA, TMALL` |
| `shop_id` | e.g. `3255036` |
| **`promotion_link`** | `http://s.click.aliexpress.com/e/xxxxx` — **download endpoint only** |
| `current_page_no`, `current_record_count` | pagination |

Sort options: `SALE_PRICE_ASC/DESC`, `DISCOUNT_ASC/DESC`,
`LAST_VOLUME_ASC/DESC`.

## What these fields make possible

| Field(s) | Decision it unlocks |
|---|---|
| `commission_rate`, `hot_product_commission_rate` | Filter to commission-eligible SKUs **at ingest**. A product we can't earn on is dead weight — this kills that waste. Partially resolves G26. |
| `original_price` + `sale_price` + history | Fake-discount detection |
| `target_app_sale_price` + `ship_to_country` | **Landed cost** |
| `evaluate_rate` + `lastest_volume` | Quality filter; excludes junk listings |
| `product_main_image_url` (CDN) | Perceptual-hash dedup |
| category fields | Enforce safety-critical exclusion at ingest (D-012) |

### On "LLM-based offer selection" (operator's idea)

**INFERENCE (high confidence):** `commission_rate`, `sale_price`, `original_price`,
`evaluate_rate`, `lastest_volume` and category all arrive **in the same record**.
That is enough to build a **deterministic** offer ranker at ingest — margin,
quality and popularity, with no LLM in the loop.

**Recommendation:** the LLM should rank *narratives* — why this product suits this
audience, how to present the honest caveat — **not** compute margins from numbers
already in the row. Asking a model to arithmetic it can read is slower, less
reproducible, and a source of silent errors. Deterministic where the data is
numeric; LLM where the task is genuinely language-shaped.

## Still unverified

| # | Gap | Status |
|---|---|---|
| **G3** | Rate limits / daily quota | **NOT VERIFIED.** Round 1's "5,000 req/day" comes from one 2025 secondary source. |
| **G4** | Is a registered non-Chinese business eligible? | **NOT VERIFIED.** The docs describe the protocol, not the eligibility policy. |
| G8 | Is any part of the affiliate API deprecated? | **NOT VERIFIED.** A round-1 capture showed a 已废弃 marker on a *different* Alibaba page. |
| G1 | Endpoint list | ✅ **Resolved** |
| G2 | Signing algorithm | ✅ **Resolved** — `hmac`/`md5` only |
| G7 | Bulk feed | ✅ **Resolved** — `hotproduct.download` with `promotion_link` |
| — | Landed-cost feasibility | ✅ **Largely resolved** via `ship_to_country` |

## Access requirements (still secondary-source)

1. AliExpress account → **Portals** → apply with traffic info → manual review.
2. Open Platform developer account → app of type **"Affiliate API"** → business licence.
3. Reported ~2 business days review; activate at `console.aliexpress.com`.
4. ⚠️ Dropship and Affiliate are **separate scopes** — a Dropship app gets
   `InsufficientPermission` on `affiliate.*`.

Source: `research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md`
