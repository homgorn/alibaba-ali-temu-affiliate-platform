# Redis for E-commerce Caching and Image Similarity

**URL:** https://redis.io/blog/redismart-retail-application-with-redis
**Publisher:** Redis
**Publish Date:** 2025-03-04
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Product catalog: The product catalog service provides product-related information and offers sophisticated ways to find products. It uses a Redis database that has the RediSearch + RedisJSON modules deployed. RedisJSON allows us to store the product details directly as JSON documents.
> RediSearch can index, query, and full-text search JSON documents. The product updates can easily be propagated across multiple sites by using Redis Enterprise's Active-Active feature."

> "Image recognition: Finally, the image recognition service offers an AI model-serving functionality for vector-similarity search on images.
> It uses a Redis database that has the RedisGears, RedisAI, and RediSearch modules installed. RedisGears allows us to build a data pipeline and execute it close to where the data lives. We took advantage of Redis AI for the AI model serving and inference.
> RediSearch is leveraged to perform the actual search for similar images based on the output of the AI model."

> "A combination of RediSearch + RedisGears + RedisAI enables AI-powered image search for finding similar products within the product catalog. In addition, features like faceted and geo-search were covered."

---

# Redis ImageScout Module for Perceptual Hashing

**URL:** https://github.com/starkdg/Redis-ImageScout
**Publisher:** GitHub (starkdg)
**Publish Date:** 2024-2025 (active)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Redis-ImageScout: A Redis module for indexing of image fingerprints for fast efficient retrieval. A perceptual hash is a fingerprint robust to small distortions - such as compression blur, scaling, etc. Useful for such things as duplicate detection and copyright protection of images.

> Installation: The Redis-Imagescout module introduces the mvptree datatype with the following commands:
> imgscout.add key hashvalue title [id] - adds a new image perceptual hash to the queue for later addition.
> imgscout.sync key - adds all the recently submitted image perceptual hashes to the index.
> imgscout.query key target-hash radius - queries for all perceptual hash targets within a given radius.
> imgscout.lookup key id - looks up an integer id.
> imgscout.size key - Returns the number of entries in the index.
> imgscout.del key id - deletes the id from the index."

---

# CDN Image Resizing and Caching Patterns

**URL:** https://medium.com/@connect.hashblock/10-cdn-image-resizers-without-origin-pain-0c1f98dd8e44
**Publisher:** Medium / Hash Block
**Publish Date:** 2025-10-10
**Access Date:** 2026-10-08

## Verbatim Quotes

> "1) Cloudflare Images/Resizing (Workers optional)
> Why: Dead-simple query params, global edge, modern formats (AVIF/WebP) with high hit-rates.
> How it works:
> * Serve https://cdn.example.com/foo.jpg?width=1200&quality=75&format=auto.
> * Add signed variants so only allowed sizes/formats get computed.
> * Optionally front with a Worker to normalize params and set a clean cache key."

> "A news site serving 80M monthly sessions moved from origin-Thumbor to CloudFront+Lambda@Edge. After bucketing widths to six sizes and turning on stale-while-revalidate, p95 TTFB dropped 37%, origin CPU fell 68%, and transform cost became negligible because 94–96% of traffic hit CDN cache."

> "10) Hybrid: Origin pre-bakes, CDN only negotiates format
> Why: Maximum cache reuse; images already resized to a small set of breakpoints. CDN simply serves AVIF/WebP/PNG based on Accept or Client Hints."

---

# Caching E-Commerce Data (Square)

**URL:** https://developer.squareup.com/blog/caching-e-commerce-data-for-the-web
**Publisher:** Square Developer
**Publish Date:** 2021-05-26
**Access Date:** 2026-10-08

## Verbatim Quotes

> "The catalog service provides all the catalog data for the websites we power. This includes products, categories of products, store locations, and many others.
> While some catalog data is fairly simple to present in an API response, other parts are more costly to calculate."

> "We start by receiving a request to one of our URLs such as: /users/123/products/456?in_category[]=1&in_category[]=6&includes=images,options,modifiers. Initially we don't have a response in cache for that request and the response gets generated as usual. As we generate the response, we do the following:
> In either case, as we gather the data, a list of tags was generated for each element of the response.
> For the purpose of the full response cache, we collect all the tags that were generated. If any element of the response changes, and is cleared via one of its tags, a response containing that element will also need to be invalidated in the cache."

> "For example, if I made a request to /users/123/products/456?price_max=45, that could return 3 items that are worth less than $45. When changing the price of an unrelated item from $200 to $20, I need to make sure that cached response gets invalidated, as it should now return 4 items.
> We currently do this simply by adding a fairly generic tag like user:123:products to all responses that list products, and invalidating that tag whenever any of this user's products change."

> "Since initially writing this article, we've been able to make use of those exact caching strategies to cache our dynamic API responses via a CDN. This not only improves the response times even more, it also enables the CDN to respond directly with up to date cached content when available therefore decreasing the load on our services."