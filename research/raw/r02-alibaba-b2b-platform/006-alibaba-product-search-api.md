# Alibaba.com Product Search API (aliexpress.open/api.searchproduct)

**Title:** 阿里巴巴国际站关键字搜索 API 实战：从多条件筛选到商品列表高效获客
**URL:** https://developer.aliyun.com/article/1678239
**Publisher:** 阿里云开发者社区 (Alibaba Cloud Developer Community)
**Publish Date:** 2025-08-20T09:13:48.000Z
**Access Date:** 2026-10-08
**Source Type:** Official technical documentation (Alibaba Cloud)

## VERBATIM QUOTES (Original Language - Chinese)

### Interface Overview
"阿里巴巴国际站提供的alibaba.product.search接口是实现关键字搜索商品列表的核心接口，支持多维度筛选条件组合，满足不同场景的搜索需求。"

### Key Features
- "基于 TOP 开放平台架构，采用统一的签名认证机制"
- "支持复杂条件组合搜索（关键字、价格、销量、评分等）"
- "分页加载数据，最大页容量为 50 条"
- "响应包含商品基本信息、价格、卖家、销量等核心数据"

### Interface Endpoint
"接口端点： https://gw.api.alibaba.com/openapi/param2/2.0/aliexpress.open/api.searchproduct"

### Common Parameters
- "app_key：应用唯一标识"
- "method：接口名称，固定为alibaba.product.search"
- "timestamp：请求时间戳（yyyy-MM-dd HH:mm:ss）"
- "format：响应格式，默认 JSON"
- "v：API 版本，固定为 2.0"
- "sign：请求签名"
- "partner_id：合作伙伴 ID（可选）"

### Business Parameters
- "keywords：搜索关键字（必填）"
- "page_no：页码，默认 1"
- "page_size：每页条数（1-50）"
- "min_price/max_price：价格区间筛选"
- "sort_type：排序方式（price_asc/price_desc/sales_desc/rating_desc）"
- "category_id：分类 ID 筛选"
- "trade_assurance：是否仅保价商品（true/false）"
- "shipping_country：目标配送国家"

### Response Fields
- "total_results：总搜索结果数"
- "page_no/page_size：分页信息"
- "products：商品列表数组"
- "filters：可用筛选条件（用于前端筛选项展示）"

### Python Implementation Example
Full Python class implementation provided with signature generation using HMAC-SHA1.

### Important Limitations (VERBATIM)
"- alibaba.product.search接口需要在开放平台申请使用权限
- 免费开发者账号有调用频率限制（通常 QPS=10）
- 部分筛选条件（如品牌筛选）需要额外权限"

---

## CONFIDENCE: HIGH
This is an official Alibaba Cloud Developer Community article documenting the Alibaba.com international site product search API. It clearly shows: (1) there IS a public product search API (alibaba.product.search), (2) it requires permission application on the open platform, (3) free tier has QPS=10 limit, (4) endpoint is on gw.api.alibaba.com, (5) uses standard TOP platform authentication. This contradicts the "no public API" belief. However, the article is from 2025-08-20 (recent). Need to verify if this API is still accessible to non-merchants. The requirement "需要在开放平台申请使用权限" (need to apply for permission on open platform) suggests gatekeeping.