# Source: Amazon PA-API 5 Deprecation Notice

**URL**: https://webservices.amazon.com/paapi5/documentation/
**Publisher**: Amazon.com Associates Central (official Amazon)
**Access date**: 2026-10-08
**Publish date**: footer reads "© 1996-2025, Amazon.com, Inc."
**Source type**: PRIMARY — official vendor documentation

## VERBATIM

> "The Amazon Product Advertising API 5.0 (PA-API 5) has been and is being
> replaced by the [Creators API]. New and existing integrations should move to
> the Creators API to continue accessing Amazon's product catalog."

> "PA-API 5 is no longer the recommended way to access Amazon's product catalog.
> The Creators API is the supported successor and receives all new features and
> ongoing improvements. If your application still calls PA-API 5, plan your
> migration to the Creators API to avoid disruption."

### What callers actually receive now

> "Applications that continue to call PA-API 5 receive an HTTP
> `"__type": "com.amazon.paapi5#AccessDeniedException"`,
> `"Code": "AccessDenied"`,
> `"Message": "Product Advertising API is deprecated. Please migrate to Creators API using the migration guide at https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi."`"

**Migration guide URL (verbatim from the error message):**
`https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi`

## Why this matters for THIS project

Every tutorial, SDK and GitHub repo written before ~2025 for Amazon affiliate
integrations targets PA-API 5. Those are now **dead on arrival** — they will
receive `AccessDenied` and fail at runtime, not at build time.

**Practical consequence:** any Amazon module in this project must target
**Creators API**, never PA-API 5. Any prior art found during research must be
date-checked before being trusted as a reference implementation.

---

# Source: Amazon Creators API Reference

**URL**: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/
**Publisher**: Amazon.com Associates Central (official Amazon)
**Access date**: 2026-10-08
**Source type**: PRIMARY — official vendor documentation

## VERBATIM — supported operations

> "Creators API supports the following operations:
> - Lookup information for a Browse Node
> - Provides item attributes, offer listings, images, and other details for a given item
> - Searches for items on Amazon based on keywords
> - Returns variations for an item i.e. a set of items that are the same product, but differ according to a consistent theme, for example size and color"

## VERBATIM — high-level resources

> "Returns browse node information associated with an item
> Returns browse node information associated with a Browse Node for a [search]
> Returns image URLs for an item in various sizes
> Returns item information (Title, Brand, Description, etc.) for an item
> Returns the parent ASIN for an item.
> Returns dynamic search refinements for a search request"

## VERBATIM — marketplaces

> "Creators API supports multiple Amazon marketplaces across the world. Each
> marketplace has specific configuration requirements including marketplace
> endpoint and region."

## Inference (labelled)

- **INFERENCE (high confidence):** the operations map onto the three primitives
  this project's engine needs — get-one (ItemLookup), search (SearchItems),
  browse (BrowseNode), plus **variations**, which is Amazon's own notion of
  "same product, different variant". That last one is directly relevant to the
  dedup problem in `docs/wiki/40-feeds-data/PRODUCT-IDENTITY.md`.
- **INFERENCE (medium confidence):** "Returns the parent ASIN for an item" is a
  built-in product-grouping signal. It does not solve cross-marketplace dedup
  (an AliExpress listing has no ASIN), but it means Amazon-side variant grouping
  is available without implementing our own clustering.

## Not verified

- Exact endpoint paths, auth scheme, and rate limits were **not** captured —
  the overview page returned HTTP 404 ("You do not have permission to perform
  the requested operation"), and the reference page content was rendered from
  JS. **UNVERIFIED — requires an authenticated Associates account to confirm.**

**CLASSIFICATION**: HARD FACT (both captures are official Amazon documentation)
**CONFIDENCE**: 9/10 for the deprecation and the operation/resource list; 4/10 for
anything beyond that (endpoints/auth/limits not captured).
