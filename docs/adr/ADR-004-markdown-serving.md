# ADR-004 — Serving `.md` Twins

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-08 |
| **Deciders** | orchestrating agent |
| **Relates to** | SPEC-004 §2.2, ADR-002 |

## Context

SPEC-004 requires every page to have a `.md` twin at a predictable URL, generated
from the same source as the HTML (FR-6), discoverable via a `Link:` header
(FR-9/FR-10), and consistent with the HTML to the character (FR-7).

Open question Q5 from SPEC-004: **can Cloudflare set arbitrary response headers
per route at the CDN level?** If yes, the header is config. If no, it must be
emitted per-page from the template.

## Decision

**Generate `.md` as static build artifacts**, emitted from the same render
function as the HTML, and **set the `Link:` header at the CDN level, with a
per-page template fallback.**

URL convention: **`page.html.md`** — extension appended, preserving the original
path and avoiding route collision.

## Alternatives considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Static artifacts + CDN header, template fallback** | Works with or without CDN header support; zero per-request cost; trivially cacheable; same source as HTML so cannot diverge | Build output grows (roughly +40% bytes); a `.md` twin can go stale if the HTML is re-rendered without rebuilding the twin — mitigated by generating both from one call | ✅ **Chosen** |
| **Generated at request time by a Worker** | Always fresh; no build-output bloat | Per-request CPU; a separate render path that could diverge from the HTML — violating FR-6; more failure modes | ❌ |
| **`.md` only, no HTML fallback changes** | — | Not a real option — HTML is mandatory | — |
| **`.md` at a parallel path (`/md/product/12345`)** | Clean separation | Violates the llms.txt spec convention of same-URL; more routing complexity | ❌ |

## Consequences

**Positive**
- FR-7 (factual equality) is structurally guaranteed: one render call emits both.
  A price change updates both in the same build.
- Static files get free CDN caching and no cold-start cost.
- The template fallback means the project still complies with FR-9 if Cloudflare
  cannot set headers globally (SPEC-004 Q5).

**Negative**
- Build output size grows ~40%. Accepted — FR-25 caps HTML at 100 KB, and `.md`
  twins are text.
- If someone regenerates HTML without regenerating twins, they diverge. **Guard:
  the SPEC-004 compliance test asserts price/link/caveat equality and fails the
  build.** The test is the mechanism, not a convention.
- Both `page.html.md` and (from older builds) `page.md` could coexist after a
  convention change, fragmenting retrieval. **Mitigation: never change the
  convention without a redirect from the old form.**

## Why append rather than replace the extension

`page.html.md` (append) vs `page.md` (replace):

- **Append** keeps the original path visible in the `.md` URL, so there is no
  ambiguity with an existing `page.md` route, and it works for extensionless
  paths via `index.html.md`.
- **Replace** is shorter but collides if a page ever legitimately ends in `.md`,
  and makes it ambiguous whether `/product/1.md` is a content route.

The llms.txt v2 spec explicitly permits **either**. This project picks one and
holds it consistently, because mixing both fragments agent retrieval (FR-8).

## Revisit when

- The catalogue grows so large that `.md` twins materially slow builds (NFR-6).
- CDN header support is confirmed **and** a per-request freshness requirement
  appears.
