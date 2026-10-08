# SPEC-004 — Static-First Web & LLM Discoverability

| Field | Value |
|---|---|
| **ID** | SPEC-004 |
| **Status** | **Approved** |
| **Author** | orchestrating agent |
| **Date** | 2026-10-08 |
| **Reviewers** | operator (pending) · architect agent (pending) |
| **Depends on** | SPEC-001 (ingestion), SPEC-003 (schema) |
| **Evidence** | [`docs/wiki/50-strategy-traffic/LLM-DISCOVERABILITY.md`](../wiki/50-strategy-traffic/LLM-DISCOVERABILITY.md) · `platform.openai.com/docs/bots` · `llmstxt.org` |

---

## 1. Context

Decision D-010 commits this project to **static-first HTML with `.md` twins**.
This spec makes that commitment enforceable rather than aspirational.

### Why, in one paragraph

AI crawlers cannot be relied upon to execute JavaScript. OpenAI's crawler
documentation specifies which bots exist and what they do — but says nothing
about whether `OAI-SearchBot` renders JavaScript. That silence is not evidence.
The design choice follows from asymmetric risk: **building for "no JS" is safe
under every hypothesis about crawler behaviour; building for "JS is rendered" is
safe under none.** So no page may depend on client-side execution.

Meanwhile `llms.txt` has moved from proposal to convention: thousands of sites
publish it, documentation platforms generate it automatically, and **Chrome
Lighthouse now audits for it** as part of agentic browsing checks. A curated
Markdown entry point plus per-page `.md` twins is the current mechanism for
being read cheaply by agents.

### The competitive angle

Almost no e-commerce or affiliate site serves `.md` twins. That is cheap to add
and hard for an incumbent to retrofit — they would have to rebuild their
templates. It is a distribution advantage that costs one build step.

### What this is NOT

This is not an argument for "SEO is dead" or "AI is the future". It is a
**defensive** requirement: make sure our content is not invisible to a class of
crawler whose behaviour we cannot observe. The classical SEO fundamentals are
still required and are unaffected.

---

## 2. Functional Requirements

### 2.1 Static-first rendering

- **FR-1** Every public page MUST return complete, meaningful content in the
  **server HTML response**. Fetching a page with JavaScript disabled MUST show
  the product title, price, key facts and affiliate link.
- **FR-2** No page's primary content may be absent from the server-rendered HTML.
  Client-side rendering MAY **enhance** (image galleries, filters, sorting) but
  MUST NOT **reveal**.
- **FR-3** Content MUST be generated from the database at **build time**, not
  fetched client-side. A page whose data is only obtainable via an in-page
  `fetch()` is non-compliant.
- **FR-4** Each page MUST declare its primary content in a machine-readable way
  that the automated test can assert against (see §6).

### 2.2 Markdown twins

- **FR-5** Every public page MUST be available as Markdown at a **predictable
  URL**.
- **FR-6** The `.md` twin MUST be generated **from the same source as the HTML**,
  never authored separately. Two hand-maintained copies diverge, and divergence
  is how a page starts lying about price.
- **FR-7** The `.md` twin MUST contain the same factual content as the HTML:
  identical price, identical affiliate link, identical caveats. A test MUST
  assert this equality.
- **FR-8** URL convention MUST be consistent and singular. **Choose one:**
  `page.html.md` (extension appended) or `page.md` (extension replaced). Mixing
  both fragments retrieval. **This spec selects `page.html.md`** — appending
  preserves the original path, so no route collision.
- **FR-9** The `.md` twin MUST be discoverable via
  `Link: </path/page.html.md>; rel="alternate"; type="text/markdown"`.
- **FR-10** The `Link:` header MUST be emitted by the **CDN/origin config**, not
  only by per-page markup, so it works for non-HTML resources too and cannot be
  forgotten by a template edit.

### 2.3 llms.txt

- **FR-11** `/llms.txt` MUST exist at the site root, and MUST conform to the
  llms.txt v2 format: an `# H1` title, a `> blockquote` summary, optional
  detail, then `## H2` sections of markdown links.
- **FR-12** Every link in `llms.txt` MUST resolve to a page that exists. This MUST
  be verified by a test, not by inspection — a dead link wastes the agent's
  budget and damages trust in the whole file.
- **FR-13** `llms.txt` MUST be **generated** from the site's real content, so it
  cannot drift as the catalogue changes.
- **FR-14** A `## Optional` section MAY hold secondary links an agent can skip
  under budget pressure.

### 2.4 Crawler policy

- **FR-15** `/robots.txt` MUST explicitly **allow** `OAI-SearchBot`. Blocking it
  removes the site from ChatGPT search results entirely.
- **FR-16** The `GPTBot` decision MUST be an **explicit, documented choice**, not
  a default. It governs training use, not search visibility, and the two controls
  are independent.
- **FR-17** `robots.txt` MUST state `User-agent: *` rules AND per-bot rules, and
  MUST reference `/sitemap.xml` and `/llms.txt`.
- **FR-18** A build-time check MUST warn when a robots.txt change is made, since
  OpenAI documents that **changes take ~24 hours to take effect** — a same-minute
  check would produce a false negative.

### 2.5 Structured data

- **FR-19** Product pages MUST emit `schema.org/Product` with `Offer` including
  price, currency, availability and `url`.
- **FR-20** Where available, `AggregateRating` and `Review` MUST be emitted.
- **FR-21** Structured data MUST reflect the **same values as the visible page**.
  A mismatch between structured data and visible content is the classic cause of
  a manual action.

### 2.6 Honesty in markup

- **FR-22** A page MUST visibly state which cost components are **not** included
  in any displayed total, and MUST NOT present an incomplete total as final.
- **FR-23** Where a value is unknown, the markup MUST say so in text.
  **Inventing a value to make a page look complete is prohibited.** This is the
  mission's core requirement, enforced at the rendering layer.
- **FR-24** Affiliate disclosure MUST be present in the visible HTML — not
  injected by JS. This is a legal requirement (54-ФЗ and equivalents) and
  therefore cannot depend on client execution.

### 2.7 Performance

- **FR-25** HTML for a product page MUST be **< 100 KB** uncompressed. An agent
  paying per token should not have to process a page that is mostly navigation.
- **FR-26** Pages MUST render without third-party JavaScript for content. Third-
  party scripts MAY be added for analytics **after** content, and MUST NOT block
  first paint.

---

## 3. Non-Functional Requirements

| # | Requirement | Threshold |
|---|---|---|
| **NFR-1** | Primary content in raw HTML | 100% of pages (automated, FR-4) |
| **NFR-2** | `.md` twin factual equality with HTML | 100% — price, link, caveats must match exactly |
| **NFR-3** | `llms.txt` link validity | 100% resolve |
| **NFR-4** | LCP on static page | < 1.5 s on a mid-tier connection |
| **NFR-5** | HTML size, product page | < 100 KB (FR-25) |
| **NFR-6** | Build time, 10k pages | < 10 min on the dev machine |
| **NFR-7** | Content/JS ratio | ≥ 80% of page content present without JS |
| **NFR-8** | Broken-link rate in `llms.txt` | 0% |

---

## 4. Acceptance Criteria

**AC-1** *(FR-1)* — Given a product page, when fetched with JavaScript disabled,
then the title, current price, currency, and affiliate link are all present in
the response body.

**AC-2** *(FR-2, NFR-1)* — Given the full page set, when the compliance test runs,
then every page passes. **The test fails if any single page regresses** — this is
the guard that protects D-010 from later refactors.

**AC-3** *(FR-3)* — Given a product page's HTML source, when inspected, then no
network request is required to obtain title or price. The data is inlined at
build time.

**AC-4** *(FR-5, FR-8)* — Given `/product/12345`, when `/product/12345.html.md`
is fetched, then a Markdown document is returned.

**AC-5** *(FR-6, FR-7, NFR-2)* — Given a product page, when the HTML price and
the `.md` twin price are parsed, then they are **identical strings**. When a
price changes in the database and the site rebuilds, then **both** change.

**AC-6** *(FR-7)* — Given a product page displaying "shipping not known for this
destination", when the `.md` twin is parsed, then that same caveat appears.

**AC-7** *(FR-9)* — Given any page, when the response headers are inspected, then
a `Link` header exists containing `rel="alternate"` with
`type="text/markdown"` pointing at that page's `.md` twin.

**AC-8** *(FR-10)* — Given the CDN config, when no template is modified, then the
`Link:` header is still emitted — proving it comes from the edge, not the page.

**AC-9** *(FR-11)* — Given `/llms.txt`, when parsed, then it contains an H1, a
blockquote summary, and at least one H2 section of links.

**AC-10** *(FR-12, NFR-3, NFR-8)* — Given every link in `llms.txt`, when each is
requested, then **all** return HTTP 200. Zero dead links.

**AC-11** *(FR-13)* — Given a product is added to the database, when the site
rebuilds, then it appears in `llms.txt` without a manual edit.

**AC-12** *(FR-15)* — Given `/robots.txt`, when parsed for `OAI-SearchBot`, then
an `Allow` directive is present.

**AC-13** *(FR-16)* — Given the repository, when searched for `GPTBot`, then a
documented, deliberate decision exists with its rationale. Absence of a decision
is a failure.

**AC-14** *(FR-17)* — Given `/robots.txt`, when parsed, then it contains a
`Sitemap:` directive and a reference to `/llms.txt`.

**AC-15** *(FR-19)* — Given a product page, when structured data is parsed, then a
valid `Product` with `Offer.price`, `Offer.priceCurrency`, `Offer.availability`
and `Offer.url` is present.

**AC-16** *(FR-21)* — Given a product page, when structured data price and visible
page price are compared, then they match exactly. Mismatch fails the build.

**AC-17** *(FR-22)* — Given a product with unknown shipping, when the page renders,
then the visible text names shipping as unknown, and the displayed total is
visibly marked incomplete.

**AC-18** *(FR-23)* — Given a product with no known duty, when the page renders,
then no duty figure is displayed and no placeholder value is shown.

**AC-19** *(FR-24)* — Given any page containing an affiliate link, when the raw
HTML is inspected, then the disclosure text is present **without** executing
JavaScript.

**AC-20** *(FR-25, NFR-5)* — Given a product page, when the HTML body is measured,
then it is under 100 KB.

**AC-21** *(FR-26)* — Given a page load with third-party scripts blocked, then all
primary content is present.

**AC-22** *(FR-4)* — Given any page, when it is inspected, then a declared marker
identifies where the primary content begins and ends, so the compliance test has
a stable target to assert against.

---

## 5. Edge Cases

| # | Case | Required behaviour |
|---|---|---|
| **EC-1** | Product disappears from the database between builds | Serve a 404/410 with an honest message. **Never** a soft-404 page with unrelated content. |
| **EC-2** | Price changes while the site is being rebuilt | The build must be consistent — one snapshot per build. A page showing yesterday's price next to today's affiliate link is worse than a rebuild delay. |
| **EC-3** | A page is very large (many variants, huge description) | Truncate for the HTML summary; the `.md` twin may carry more detail. Do not exceed FR-25. |
| **EC-4** | A product has no image | Render without an image rather than a broken `<img>`. Broken images waste agent tokens and signal neglect. |
| **EC-5** | `llms.txt` grows beyond a sensible size | Move detail behind links. The file "stays small enough to fit in context" — detail belongs behind the links. |
| **EC-6** | Locale segment produces `.md` duplicates | `/en/product/1.html.md` and `/product/1.html.md` must resolve deterministically, with an explicit canonical, not silent duplication. |
| **EC-7** | Structured data and visible price genuinely disagree because of a concurrent write | Build MUST fail, not silently publish the mismatch. |
| **EC-8** | A page has zero products (empty category) | Return a valid page with an honest "nothing here yet" — or a 404. **Not** a page with fabricated filler items. |
| **EC-9** | `robots.txt` blocks a crawler we later want | Log the effective policy per bot at build time, because the change takes ~24 h to propagate (FR-18). |
| **EC-10** | Markdown contains a pipe character or special syntax | Escape properly. A broken `.md` twin is worse than none. |
| **EC-11** | A `.md` twin is requested for a page that does not exist | 404. Never fall back to the HTML page served as Markdown. |
| **EC-12** | Content includes text that a Markdown renderer would misinterpret | Sanitise at generation time; the twin is generated, so this is a generation bug, not a runtime one. |
| **EC-13** | Build produces a page with an affiliate link but no visible product | Fail the build. A monetised page with nothing to sell is an affiliate link farm — explicitly out of scope per the mission. |
| **EC-14** | Very long product titles overflow the meta description | Truncate at a sentence/word boundary, never mid-word. |

---

## 6. The Compliance Test (NFR-1 / FR-4)

This is the mechanism that makes D-010 permanent rather than aspirational.

### Declaration

Every page template declares its primary content region:

```html
<main data-primary-content>
  <!-- everything here MUST be present in the raw HTML response -->
</main>
```

### Assertions

```
1. Fetch the page with JavaScript DISABLED.
2. Assert the response contains, inside [data-primary-content]:
   - a product title (non-empty, matches the DB row)
   - a price with its currency code
   - an affiliate link
   - if a total is displayed: the completeness caveat
   - the affiliate disclosure text
3. Assert total HTML < 100 KB.
4. Parse the .md twin; assert price string, affiliate link, and caveats are
   IDENTICAL to the HTML.
5. Assert the Link: header is present and points at the .md twin.
```

### Failure semantics

**Any single page failing MUST fail the build.** Not warn. Not warn-and-continue.

The reason: the HTML-first requirement will be violated casually, by a well-
meaning refactor that moves a component behind a `<Suspense>` boundary. A
warning is invisible within a week; a red build is not.

### Negative test (verifier requirement)

The guard MUST be proven to work: temporarily render a page client-side only,
confirm the suite **fails** and names the page, then restore. A test that cannot
fail proves nothing.

---

## 7. API Contracts

```ts
export interface PageArtifact {
  readonly path: string;                 // '/product/12345'
  readonly markdownPath: string;         // '/product/12345.html.md' (FR-8)
  readonly htmlBytes: number;            // < 100 KB (FR-25)
  readonly primaryContent: {
    readonly title: string;
    readonly priceMinor: number | null;  // null = unknown (FR-23)
    readonly currency: string | null;
    readonly affiliateLink: string | null;
    readonly disclosure: string;         // always present (FR-24)
    readonly incompleteTotal: boolean;   // true if any component unknown
    readonly unknownComponents: readonly ('shipping' | 'duty' | 'delivery')[];
  };
}

export interface SiteManifest {
  readonly pages: readonly PageArtifact[];
  readonly generatedAt: string;          // one snapshot per build (EC-2)
  readonly llmsTxt: string;              // generated (FR-13)
  readonly robotsTxt: string;            // includes AI-bot policy (FR-15)
}

export interface BuildValidationReport {
  readonly pagesChecked: number;
  readonly failures: readonly {
    readonly path: string;
    readonly reason:
      | 'PRIMARY_CONTENT_MISSING'
      | 'PRICE_MISMATCH_VS_DB'
      | 'MARKDOWN_PRICE_MISMATCH'
      | 'DISCLOSURE_MISSING'
      | 'INCOMPLETE_TOTAL_NOT_MARKED'
      | 'HTML_TOO_LARGE'
      | 'LLMS_TXT_DEAD_LINK'
      | 'STRUCTURED_DATA_MISMATCH'
      | 'MONETISED_WITHOUT_PRODUCT';
    readonly detail: string;
  }[];
  readonly passed: boolean;              // false ⇒ build fails
}
```

---

## 8. Out of Scope

| Excluded | Reason |
|---|---|
| **Interactive features requiring JS** | Filters, sorting, galleries — enhancement only (FR-2). |
| **User accounts, login, comments** | Not required for the product. |
| **A/B testing of page variants** | Would multiply build complexity and split SEO signals before any traffic exists. |
| **Server-side rendering at request time** | Build-time generation is the mechanism. Runtime SSR adds latency and a failure mode. |
| **Multilingual `.md` twins beyond the primary language** | Possible later; the convention supports it without redesign. |
| **CMS / admin UI for editing content** | Content is generated from data. |
| **Automated content generation by LLM at scale** | Explicitly out of scope as a bulk strategy. The mission rejects thin generated pages, and LLM bulk content is exactly that. LLM assistance for *narrative* elements on a curated subset may be revisited. |
| **Image optimisation pipeline** | Images are served from the vendor CDN. |
| **Analytics integration** | Blocked on the tracking decision (issue #2). The `Link:` header work is independent. |
| **Telegram bot UI** | SPEC-005 / separate spec. |

---

## 9. Open Questions

| # | Question | Blocking? |
|---|---|---|
| Q1 | Does `.md` twinning measurably affect LLM citation rate? (gap G10) | **No for implementation** — the spec is cheap and Lighthouse audits it. Affects measurement, not the decision. |
| Q2 | Which additional AI bots to allow — ClaudeBot, PerplexityBot, Google-Extended, meta-externalagent? (gap G11) | No — decided per bot with documented rationale (FR-16). |
| Q3 | Do LLM crawlers treat `noindex` differently from classic search? (gap G12) | No — until known, avoid relying on `noindex` alone for anything important. |
| Q4 | Cloudflare Pages vs Workers for `.md` serving (ADR-002) | **Yes for implementation** — decides static files vs runtime generation |
| Q5 | Does Cloudflare's CDN let us set the `Link:` header globally (FR-10)? | **Yes for implementation** — must be verified before relying on it |

**Q5 is the one to check first.** FR-10 assumes a single CDN-level config point.
If Cloudflare cannot set arbitrary response headers per route, the header must be
emitted per-page from the template — which is still correct (FR-9) but weaker,
because a template edit could drop it. That would need a fallback rule.

**Verified and relied upon:** OpenAI crawler identities and the independent
`OAI-SearchBot`/`GPTBot` controls; that blocking `OAI-SearchBot` removes the site
from ChatGPT search; the ~24 h robots.txt propagation delay; llms.txt v2 format
and its `.md` twin convention; Lighthouse auditing for `llms.txt`. All captured
2026-10-08 from primary sources.
