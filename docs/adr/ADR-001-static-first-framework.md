# ADR-001 — Static-First Rendering Framework

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-08 |
| **Deciders** | operator |
| **Relates to** | D-010, SPEC-004 |

## Context

The operator named **both** Next.js and Astro. The product is a
catalogue of product pages generated from database rows, where the dominant
requirement is that content exists in the server HTML response (SPEC-004 FR-1),
with `.md` twins and `llms.txt` generated from the same source.

Constraints: TypeScript/Node 22 already installed; Cloudflare Pages + Workers is
the leading hosting candidate; no Docker on the dev machine.

## Decision

**Next.js with static export**, for the site layer. Astro remains acceptable for
pure-content microsites if a future site's needs diverge.

## Alternatives considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Next.js static export** | TypeScript end-to-end with the engine; shared types across DB/API/UI; mature ecosystem; `output: 'export'` produces pure static HTML; React components for the interactive *enhancement* layer | Heavier runtime than Astro for pure content; needs care to avoid client-side data fetching | ✅ **Chosen** |
| **Astro** | Ships near-zero JS by default; excellent content ergonomics; islands model fits static-first naturally | Separate framework → second toolchain, second component model; TS types shared via a package but not natively; weaker fit if the site grows interactive features | ❌ Not now — revisit for a content-only microsite |
| **Client-rendered SPA** | Simplest dev experience | **Would violate FR-1/FR-2.** Content may never be seen by a non-rendering crawler. Rejected on principle, not convenience. | ❌ |
| **Hand-rolled static generator** | Total control | Slow to build, easy to get HTML/`.md` divergence wrong; re-inventing proven tooling | ❌ |

## Consequences

**Positive**
- One language and one type system across engine, API and UI.
- Static export guarantees the HTML-first property structurally — it cannot
  accidentally become client-only, which is the main risk the operator was
  worried about.
- `.md` twins and `llms.txt` are generated from the same render call, so they
  cannot diverge (SPEC-004 FR-6).

**Negative**
- More JS shipped than Astro would. Mitigated by FR-26: third-party scripts load
  after content and never block first paint.
- Next.js upgrades can change export behaviour — a maintenance cost.
- Two rendering modes (static export vs runtime SSR) exist in the framework, so
  a future contributor could reach for the wrong one. **The SPEC-004 compliance
  test is the guard**, not convention.

## Revisit when

- A second site is genuinely content-only → evaluate Astro side by side.
- Site interactivity grows beyond filters/sorting → Next.js runtime SSR becomes
  necessary and FR-1 must be re-examined.

## UNVERIFIED

- Whether Cloudflare Pages accepts payment from the operator's legal entity
  (risk R-016). Affects hosting, not this framework choice.
