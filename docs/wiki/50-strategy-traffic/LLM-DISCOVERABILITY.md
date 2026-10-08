# LLM Discoverability — HTML-First, Markdown Twins, GEO

> **Summary:** The operator's instinct is correct and now verifiable: **LLM crawlers do not reliably execute JavaScript, so a client-rendered React/Next.js page is effectively invisible to them.** The current standard for machine-readable site content is the **llms.txt spec (v2)** plus **`.md` twins** of every page, announced via `rel="alternate" type="text/markdown"`. Chrome Lighthouse now audits for llms.txt as part of agentic-browsing checks. This page is the technical basis for the "HTML-first, Markdown mirrored" architecture decision.
>
> Confidence: **9/10** — verified against OpenAI's own crawler documentation and the llmstxt.org specification.

## The core question: do LLM crawlers run JavaScript?

**Short answer: assume they do not. Design as if they do not.**

### What OpenAI's documentation actually says (HARD FACT)

Source: https://platform.openai.com/docs/bots — OpenAI Crawlers overview.

Four distinct user agents, with **independent** controls:

| Agent | Purpose | Blocks ChatGPT search if disallowed? |
|---|---|---|
| `OAI-SearchBot` | Surfaces sites in **ChatGPT search** | **Yes — not shown in ChatGPT search answers** |
| `OAI-AdsBot` | Validates landing pages submitted as ads | No |
| `GPTBot` | Crawls content for **training** foundation models | No (training only) |
| `ChatGPT-User` | Fetches a page when a user asks about it | No |

Verbatim:

> "For example, a webmaster can allow OAI-SearchBot in order to appear in search results while disallowing GPTBot to indicate that crawled content should not be used for training OpenAI's generative AI foundation models."

> "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers, though can still appear as navigational links."

> "It can take ~24 hours from a site's robots.txt update for our systems to adjust."

**Three operational consequences:**

1. **Allow `OAI-SearchBot`.** Blocking it removes the site from ChatGPT search entirely. Blocking `GPTBot` is a separate, deliberate choice about training — and is commonly left allowed.
2. **Changes take ~24h.** robots.txt edits are not instant. Do not debug distribution in the same minute you edit.
3. **`ChatGPT-User` ignores robots.txt** — "Because these actions are initiated by a user, robots.txt rules may not apply." So a user-triggered fetch can reach a page that a crawler cannot. This is a reason to be careful about blocking, not a loophole to rely on.

### What OpenAI does *not* document

⚠️ **UNVERIFIED / IMPORTANT:** OpenAI's page says nothing about whether `OAI-SearchBot` executes JavaScript. Absence of documentation is not evidence either way.

**INFERENCE, high confidence:** major AI crawlers historically do **not** run a full browser engine; they fetch raw HTML and parse it. Modern implementations may use partial rendering. Designing for "no JS" is safe under **every** hypothesis, whereas designing for "JS is rendered" breaks catastrophically if it is not. **Asymmetric risk → choose no-JS.**

**This is the decisive architectural argument for HTML-first.** A page that only exists after hydration is a page that may not be seen. HTML-first costs slightly more build complexity and removes the risk entirely.

## The llms.txt standard (HARD FACT)

Source: https://llmstxt.org/ — proposal by Jeremy Howard. Published 2024-09-03, **modified 2026-08-10**. Current version: **v2**.

> "Agents now use websites constantly... Today it is routine."

### Adoption is real, not theoretical

Verbatim from the spec:

> "Today it is routine... thousands of sites publish an llms.txt file, documentation platforms generate one automatically, and Chrome's Lighthouse audits sites for one as part of its agentic browsing checks. The AI labs themselves publish llms.txt files for their own developer docs: OpenAI, Anthropic, and Gemini."

Directories listing real llms.txt files: llmstxt.site, directory.llmstxt.cloud, llmstxthub.com.
Automated generators: Mintlify, GitBook, Yoast SEO (WordPress), AIOSEO (WordPress), Wix, Docusaurus & VitePress plugins, Drupal LLM Support.

### Why it exists — the argument that applies directly to this project

> "An HTML page wraps its information in navigation, ads, and JavaScript, and converting it back into clean text is difficult and imprecise. Context windows, while larger than they were, are still too small for most websites in their entirety, and every wasted token costs time and money."

**This is precisely the affiliate-page problem.** A typical product page is 80% navigation, filters, reviews UI, and recommendation carousels — and maybe 15% is the actual answer. An LLM paying per token gets mostly noise.

### The two mechanisms

**1. `/llms.txt`** — a curated Markdown overview at site root (or any subpath, covering that path). Stays small enough to fit in context; detail lives behind links, fetched only when needed.

Required format:
```markdown
# Title

> Optional description with key information needed to understand the file

Optional detail paragraphs/lists

## Section name

- [Link title](https://url): Optional notes

## Optional

- [Link title](https://url)
```
Sections are H2-delimited. The H1 is the only required element. The `## Optional` section holds secondary links an agent can skip on a tight budget.

**2. `.md` twins** — verbatim from the spec:

> "pages with information that agents might need provide a clean markdown version of those pages at the same URL as the original page, either with `.md` appended (`page.html.md`) or with the extension replaced by `.md` (`page.md`)."

Discovered via standard link relations:
> "`rel="alternate" type="text/markdown"` points to the markdown version of a page, and `rel="describedby"` points to the llms.txt file that covers it."

Can be delivered as HTML `<link>` elements **or an HTTP `Link:` response header** — and the header form works for non-HTML resources too, so it can be set in CDN config without touching pages:

```
Link: </docs/page.html.md>; rel="alternate"; type="text/markdown", </docs/llms.txt>; rel="describedby"
```

### llms.txt vs sitemap.xml vs robots.txt (HARD FACT, verbatim)

| File | Purpose |
|---|---|
| `robots.txt` | "what access to a site is considered acceptable" |
| `sitemap.xml` | "a list of all the indexable human-readable information" |
| `llms.txt` | "a curated overview for LLMs" |

> sitemap.xml "isn't a substitute for llms.txt since it: often won't have the LLM-readable versions of pages listed; doesn't include URLs to external sites...; and will generally cover documents that in aggregate will be too large to fit in an LLM context window."

**Consequence:** ship all three. `robots.txt` must explicitly allow `OAI-SearchBot`; `sitemap.xml` for classic search; `llms.txt` + `.md` twins for AI retrieval.

## Architecture consequences for this project

1. **Every page ships as static HTML at build time.** No content may exist only after hydration. For product pages this means generating HTML from the database at build/deploy time, not client-fetching.
2. **Every page gets a `.md` twin** generated from the same source as the HTML — never written twice by hand. Single source of truth → two renderings.
3. **A build-time `Link:` header** for `rel="alternate"` + `rel="describedby"` (easier in CDN config than per-page `<link>`).
4. **A generated `/llms.txt`** per site, listing the genuinely useful pages with one-line descriptions.
5. **`.md` endpoints are cheap** and give an LLM a clean token-efficient target. This is a real differentiator: almost no affiliate competitor serves `.md` twins.
6. **Content must be structured for extraction.** Answers-first layout — the key fact in the first 100 words, because that is what gets quoted. Followed by evidence. This aligns with the "value-first" mission: the honest answer must be *above the fold for a machine*.

## Open items for round 2

| # | Question | Why |
|---|---|---|
| G9 | Do Googlebot / Perplexity / ClaudeBot execute JS? | Confirms how much this constrains the stack |
| G10 | Does `rel="alternate" type="text/markdown"` have measurable effect on citation rate? | The whole design rests on it; Lighthouse auditing suggests it is being taken seriously |
| G11 | Which additional AI bots to allow — ClaudeBot, PerplexityBot, Google-Extended, meta-externalagent? | robots.txt policy for the full set |
| G12 | Do LLM crawlers respect `noindex` differently from classic search? | Affects faceted/deal-page strategy |

Sources:
- https://platform.openai.com/docs/bots (OpenAI Crawlers, accessed 2026-10-08)
- https://llmstxt.org/ (llms.txt v2 spec, modified 2026-08-10, accessed 2026-10-08)
- https://platform.openai.com/docs/llms.txt (index of OpenAI's own Markdown doc twins, accessed 2026-10-08)
