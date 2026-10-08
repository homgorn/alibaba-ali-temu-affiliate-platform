# AliExpress/Alibaba Product ID Systems

**URL:** https://tmapi.top/ru/docs/aliexpress/item-apis/get-item-detail-by-id
**Publisher:** TMAPI
**Publish Date:** 2024-09-14
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Получение информации о товаре AliExpress (по ID)
> Обзор API
> * Базовая информация о товаре (название/цена/категория)
> * Характеристики товара
> * Основные изображения/видео
> * Информация о магазине (название магазина/ID продавца и т.д.)
> * Атрибуты SKU (название/миниатюра)
> * Цена и остаток SKU
> URL API
> Параметры запроса
> Query
> * Поле | Тип | Объяснение | Обязательно
> * item_id | integer | ID товара | истина
> * country | string | Значение по умолчанию: us | ложь"

> "AliExpress Data API - That Goes Deeper
> The most comprehensive service for e-commerce developers. High-stability proxies, bypass captchas, and get precise SKU-level data that others miss.
> SKU-Level Precision
> Most platforms only give you the product-level data. We go deeper, extracting individual SKU data even when products differ wildly under the same listing."

---

# Piloterr Alibaba Product API

**URL:** https://www.piloterr.com/library/alibaba-product
**Publisher:** Piloterr
**Publish Date:** 2026 (active)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "The Alibaba Product API returns a full Alibaba product detail page (PDP) as structured JSON. Pass a product URL or numeric product ID, optionally with subdomain, and receive localized title, HD images, tiered pricing, seller profile, attributes and lead times.
> Product pages are rendered in a headless browser and parsed from window.detailData."

> "Input formats
> * Format | Example | Resolved URL
> * Numeric ID | 1601175379813 | https://www.alibaba.com/product-detail/_1601175379813.html
> * ID + subdomain | query=1601175379813, subdomain=portuguese | https://portuguese.alibaba.com/product-detail/_1601175379813.html
> * Full URL | https://www.alibaba.com/product-detail/..._1601175379813.html | Host kept as-is"

> "Field | Type | Description
> * product_id | number | Product ID
> * title | string | Localized product title
> * url | string | Canonical product URL (no query string)
> * locale_host | string | Host used for rendering (portuguese.alibaba.com, …)
> * images | string[] | HD image URLs
> * seller.company_name | string | Legal company name
> * seller.company_id | number | Company ID
> * seller.country | string | Country code (CN, …)
> * seller.years | string | Years on Alibaba
> * seller.is_gold_supplier | boolean | Gold Supplier flag
> * seller.profile_url | string | Company profile URL"

> "Notes
> * Canonical url keeps the SEO slug (.../product-detail/Custom-Neon-Light-Acrylic-Neon-Sign_1601175379813.html), not the bare _ID.html shortcut used internally for bare IDs.
> * price.quantity_prices[].max_quantity is omitted on the open-ended top tier (e.g. min_quantity: 500).
> * trade.lead_time[].max_quantity may be omitted on the last tier when Alibaba leaves it open.
> * attributes often contains duplicate { name, value } pairs (basic + other property blocks); consumers should dedupe if needed."

---

# Bright Data AliExpress SKU Tracking

**URL:** https://brightdata.com/products/insights/sku-tracker/aliexpress
**Publisher:** Bright Data
**Publish Date:** 2026-02-16
**Access Date:** 2026-10-08

## Verbatim Quotes

> "AliExpress SKU Tracking Key Advantages
> Comprehensive SKU Intelligence
> AliExpress SKU Tracking FAQs
> [What is AliExpress SKU tracking?](#What is AliExpress SKU tracking?)
> [How does the tool handle AliExpress product variants?](#How does the tool handle AliExpress product variants?)
> Our infrastructure uses advanced AI-powered variant matching to automatically identify and track all product variations on AliExpress including size, color, configuration, and bundle options—ensuring consistently accurate tracking."

> "[Can I track both my products and competitor SKUs on AliExpress?](#Can I track both my products and competitor SKUs on AliExpress?)
> Yes, the tracking monitors all SKUs on AliExpress, including your own products and competitor offerings, providing complete visibility into category performance, competitive positioning, and market opportunities."

> "Does the tracking work for AliExpress products in all countries?
> Yes, we track SKU performance across all AliExpress geographic markets, providing comprehensive global coverage for brands managing products internationally."