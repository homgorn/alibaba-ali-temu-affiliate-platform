# Taobao Union (淘宝联盟) Overseas API Documentation

**Title:** taobao.ovs.tbk.material.item.optional (淘宝客-推广者-物料搜索正式版) - Overseas Version
**URL:** https://developer.alibaba.com/docs/api.htm?apiId=72807
**Publisher:** Taobao Open Platform (developer.alibaba.com)
**Publish Date:** 2026 (current, live page - timestamp in example: 2026-06-16)
**Access Date:** 2026-10-08
**Source Type:** Primary official API documentation

## VERBATIM QUOTES (Original Language - Chinese with English translations)

### API Description
"淘宝客-推广者-物料搜索正式版，海外联盟商品库搜索，支持入参推广者对应的"推广位"、关键词和相关筛选条件，获取对应的物料信息和推广者对应的推广链接，并且额外支持渠道自定义参数、分站物料、禁限售/运过滤、海外特色商品库等。 -- Merchandise Search, Search the overseas item library using adzone ID, keywords, and filters to get material info and promotion links."

### Server Endpoints
| 环境 | HTTP请求地址 | HTTPS请求地址 |
|---|---|---|
| 正式环境 | http://gw.api.taobao.com/router/rest | https://eco.taobao.com/router/rest |

### Required Parameters (Critical)
| 名称 | 类型 | 是否必须 | 描述 |
|---|---|---|---|
| adzone_id | Number | 必须 | 推广位ID，mm_xxx_xxx_12345678三段式的最后一段数字 -- Ad Zone ID, the last segment of the three-part "mm_xxx_xxx_12345678" |
| language | String | 必须 | 语言：zh_CN(中文)；en_US(英文) -- Language: zh_CN (Chinese); en_US (English) |
| site | String | 必须 | 站点标识：TW(台湾)；HK(香港)；MY(马来)；SG(新加坡)；AU(澳大利亚)；CA(加拿大)；MO(澳门)；GLOBAL(全球)，GLOBAL（全球）不存在禁限售的逻辑，若填写指定的站点，会校验禁限售的逻辑。 -- Site Identifier: TW (Taiwan); HK (Hong Kong); MY (Malaysia); SG (Singapore); AU (Australia); CA (Canada); MO (Macau); GLOBAL (Global). The "GLOBAL" identifier does not apply any restricted or prohibited sales logic. If a specific site is specified, the restricted/prohibited sales logic will be enforced. |

### Optional Parameters
- material_id: 物料ID，不传时默认物料ID为Site对应站点的物料ID
- start_price/end_price: 折扣价范围
- is_tmall: 是否天猫商品
- unid: 渠道自定义参数
- need_similar_recommendation: 是否需要相似推荐

### Response Fields (Key)
- total_results: 搜索到符合条件的结果总数
- next_page: 下一页页码
- has_next: 是否还有下一页
- result_list: 商品列表
  - item_id: 商品信息-淘宝客新商品id
  - publish_info: 淘客推广信息
    - income_rate: 商品信息-收入比率(%)
    - click_url: 链接-宝贝推广链接
    - coupon_share_url: 链接-宝贝+券二合一页面链接
    - commission_type: 推广信息-商品信息-佣金类型 (MKT/SP/COMMON/ZX)
    - income_info: 商品佣金信息 (commission_rate, commission_amount, subsidy_rate, subsidy_amount)

### Example Request (curl)
```
curl -X POST 'http://gw.api.taobao.com/router/rest' \
-d 'method=taobao.ovs.tbk.material.item.optional' \
-d 'partner_id=apidoc' \
-d 'timestamp=2026-06-16+18%3A07%3A25' \
-d 'v=2.0' \
-d 'adzone_id=12345678' \
-d 'site=TW' \
-d 'language=zh_CN'
```

---

## CONFIDENCE: HIGH
This is the official Taobao Open Platform API documentation for the OVERSEAS version of Taobao Union material search. Critical findings: (1) Explicitly supports overseas markets with `site` parameter (TW, HK, MY, SG, AU, CA, MO, GLOBAL), (2) Requires `adzone_id` (promotion position ID) from pub.alimama.com, (3) Supports English language (en_US), (4) GLOBAL site bypasses restricted sales logic, (5) Returns affiliate links (click_url, coupon_share_url) and commission rates. This confirms Taobao Union HAS an official cross-border/overseas API. Accessed 2026-10-08.