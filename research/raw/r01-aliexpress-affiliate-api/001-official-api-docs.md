# AliExpress Affiliate API - Official Documentation Sources

## Source 1: openservice.aliexpress.com/doc/api.htm (API Reference)
**URL**: https://openservice.aliexpress.com/doc/api.htm
**Publisher**: AliExpress Open Platform
**Access Date**: 2026-10-08
**Publish Date**: Latest update shown as 2022-04-18 15:55:40 (STALE - verify)
**Content**: Lists API categories including AE-Affiliate, AE-Logistics, AE-Product Management, AE-Order & Transaction, AE-Settlement, etc. Shows OAuth endpoints: /auth/token/create, /auth/token/refresh, /auth/token/security/create, /auth/token/security/refresh

## Source 2: openservice.aliexpress.com/doc/doc.htm?nodeId=27493&docId=118729 (Getting Started)
**URL**: https://openservice.aliexpress.com/doc/doc.htm?nodeId=27493&docId=118729
**Publisher**: AliExpress Open Platform
**Access Date**: 2026-10-08
**Publish Date**: Latest update 2026-09-11 16:28:08
**Content**: Developer guide with sections for Overseas Developers, Affiliate Developers, DropShippers API Developer. Lists authorization endpoints.

## Source 3: open.alitrip.com/docs/api.htm?apiId=45794 (aliexpress.affiliate.hotproduct.query)
**URL**: http://open.alitrip.com/docs/api.htm?apiId=45794
**Publisher**: Taobao Open Platform (AliExpress)
**Access Date**: 2026-10-08
**Publish Date**: Unknown (page appears current)
**Content**: Full API specification for aliexpress.affiliate.hotproduct.query with all request/response parameters, examples in Java, .NET, PHP, CURL, Python.

## Source 4: open.alitrip.com/docs/api.htm?apiId=48598 (aliexpress.affiliate.hotproduct.download)
**URL**: http://open.alitrip.com/docs/api.htm?apiId=48598
**Publisher**: Taobao Open Platform (AliExpress)
**Access Date**: 2026-10-08
**Publish Date**: Unknown
**Content**: Full API specification for aliexpress.affiliate.hotproduct.download - bulk hot product download endpoint.

## Source 5: developer.alibaba.com/docs/doc.htm?articleId=118934 (How to invoke affiliate API)
**URL**: https://developer.alibaba.com/docs/doc.htm?articleId=118934&docType=1&treeId=674
**Publisher**: Alibaba Developer Documentation
**Access Date**: 2026-10-08
**Publish Date**: Updated 2022/01/13 (STALE - verify)
**Content**: Affiliate API invocation guide. Shows overseas environment URLs: US (api.taobao.com), EU (de-api.aliexpress.com), Russia (ru-api.aliexpress.com). Shows signature algorithm (MD5, HMAC).

## Source 6: developer.alibaba.com/docs/doc.htm?articleId=118193 (Affiliate API - Deprecated notice)
**URL**: https://developer.alibaba.com/docs/doc.htm?articleId=118193&docType=1&treeId=674
**Publisher**: Alibaba Developer Documentation
**Access Date**: 2026-10-08
**Publish Date**: Updated 2021/03/30 (STALE - verify)
**Content**: WARNING: Marked as 已废弃 (Deprecated). Shows overall flow for API access. Requires AliExpress Portals account to activate developer account at console.aliexpress.com.

## Source 7: open.alitrip.com/docs/doc.htm?articleId=108103 (User Authorization Introduction)
**URL**: https://developer.alibaba.com/docs/doc.htm?articleId=108103&docType=1&treeId=502
**Publisher**: Taobao Open Platform
**Access Date**: 2026-10-08
**Publish Date**: Unknown
**Content**: OAuth 2.0 flow documentation. Key finding: "Is a sandbox test mandatory for user authorization? The AliExpress development platform does not support a sandbox test." Formal environment: https://oauth.aliexpress.com/authorize and https://oauth.aliexpress.com/token

## Source 8: portals.aliexpress.com (Affiliate Portals)
**URL**: https://portals.aliexpress.com/
**Publisher**: AliExpress Affiliate Program
**Access Date**: 2026-10-08
**Publish Date**: 2026 (copyright 2003-2026)
**Content**: Marketing page. Claims: 120M+ affiliate products (as of 2026), up to 9% basic commission rate (up to 90% for Hot Products), 200+ supported countries. Tools: Affiliate API, Server-to-server order pushes.

## Source 9: wasabitheme.com/blog/aliexpress-affiliate-api (How to get and set up AliExpress Affiliate API)
**URL**: https://wasabitheme.com/blog/aliexpress-affiliate-api
**Publisher**: Wasabi Theme
**Access Date**: 2026-10-08
**Publish Date**: 2025-02-04
**Content**: Step-by-step guide. Key findings:
- Must create AliExpress account → Portals → apply with traffic info → manual review
- Must create Open Platform developer account → create "Affiliate API" type app → business license required
- Review takes ~2 business days
- API daily limit: 5,000 requests/day (as of 2025)
- Not all products have affiliate commissions
- Search for promotable products at: https://portals.aliexpress.com/adcenter/affiliateProductSearch.htm

## Source 10: shopping-assistant/docs/aliexpress-api.md (GitHub)
**URL**: https://github.com/wuTims/shopping-assistant/blob/main/docs/aliexpress-api.md
**Publisher**: wuTims/shopping-assistant
**Access Date**: 2026-10-08
**Publish Date**: Unknown
**Content**: Shows OAuth 2.0 with HMAC-SHA256 signing. Critical: "Our app has Dropship API access only. Affiliate APIs (aliexpress.affiliate.*) return InsufficientPermission." Different permission scopes.

## Source 11: GitHub SDKs (multiple)
- luya2/ae_sdk-api (2025-04-28): TypeScript SDK for affiliate APIs
- gregojoao/aliexpress-affiliate (2026-05-14): .NET SDK
- sergioteula/python-aliexpress-api: Python SDK
- Ericnowhere/aliexpress-affiliate-php (2026-03-02): PHP SDK
- allanchangcl/aliexapi: PHP SDK (2016, legacy)

## Source 12: Affiliate Program Review Sites (2025-2026)
- affiliateprogramsguru.com (2026-03-25): Commission 0-9% (up to 90% Hot Products), 3-day cookie, $16 min payout, Net 60 locking, $15 bank fee
- diggitymarketing.com (2026): 3-day cookie, $50 cap, $16 min payout
- FlexOffers (2026-07-24): Worldwide program 10-day cookie, 0.8%-16.83% commission
- Awin (2026): US program 10-day cookie, 2.4%-7% commission

## Source 13: Stack Overflow / GitHub Issues
- Stack Overflow 77718066: IncompleteSignature error on aliexpress.affiliate.link.generate
- GitHub gist gmjelle: Signature algorithm implementation
- Botize.com: Influencer Program blocks Affiliate API access