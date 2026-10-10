# Alibaba / AliExpress / Temu — Affiliate Intelligence Platform

> **Give people an answer they cannot get from a search engine — and earn from
> their decision.**

A static-first, LLM-discoverable affiliate platform: product ingestion from
affiliate APIs, honest price history, and true landed-cost computation.

**Status:** Phase 0–2 complete. **Phase 3 (engine) complete: 24 tables, 127
tests, 5 features independently verified** (F011 migrations, F012 ingestion,
F013 price history, F014 lookup API, F017 safety exclusions). Live API still
needs credentials. **North star:** first real commission received.

---

## What makes this different

Most affiliate content is a link with a sentence around it. This project is built
the other way round:

| Principle | What it means concretely |
|---|---|
| **Landed cost, honestly** | Item + shipping + duty + VAT + delivery time — and an explicit statement of what could **not** be determined. An unknown is shown as unknown, never as zero. |
| **Fake-discount detection** | Distinguishing a real 40% cut from a price inflated for 30 days and "discounted" back to normal. |
| **Invisible to nobody** | Every page ships complete HTML on the server. `.md` twins, `llms.txt`, and `Link:` headers so AI answer engines can read us cheaply. |
| **Some things are excluded** | Safety-critical categories (batteries, chargers, PPE, baby goods) are **excluded entirely**, not warned about. A safety failure injures someone. |
| **Never fabricate** | Unverified facts are marked `UNVERIFIED` with what was attempted. An honest gap beats a confident guess. |

### Why "static-first" is not a preference

LLM crawlers cannot be relied upon to execute JavaScript. If content only exists
after hydration, it may never be seen. Designing for "no JS" is safe under every
hypothesis about crawler behaviour; designing for "JS is rendered" is safe under
none. Verified against OpenAI's crawler documentation and the llms.txt v2 spec —
see [`docs/wiki/50-strategy-traffic/LLM-DISCOVERABILITY.md`](docs/wiki/50-strategy-traffic/LLM-DISCOVERABILITY.md).

---

## Current state

### What the research found

| Finding | Confidence |
|---|---|
| **AliExpress Affiliate API is real and fully documented** — 11 endpoints, TOP protocol, `hmac`/`md5` signing, gateway `gw.api.taobao.com/router/rest` | 8/10 |
| **`ship_to_country` returns destination-country pricing under that country's tax policy** — this makes landed cost a lookup, not a customs simulation | 8/10 |
| **`hotproduct.download` is a bulk feed that includes `promotion_link`** — ready-made affiliate links | 8/10 |
| **Temu has no public API** — both partner pages are JavaScript shells. No module will be built | 7/10 |
| **Amazon's PA-API 5 is deprecated** and now returns `AccessDenied`. Any pre-2025 Amazon tutorial is dead on arrival | 9/10 |
| **Alibaba.com B2B affiliate exists** (up to 15%) but requires `TradeCompleted` and blocks all MMP attribution | 9/10 |
| **Cookie window is 3 days** and commission is 0–9% nominal (up to 90% on Hot Products) — the binding constraint on all traffic strategy | 7/10 |

### What is NOT known

Stated plainly, because guessing would be worse than admitting it:

- **EPC / CPC / conversion rates** — no source obtainable. **Decision D-020 forbids paid-traffic spend until measured.**
- Commission rates for most affiliate networks.
- Exact API quota magnitude, and whether a non-Chinese business entity qualifies.
- RU/CIS competitive landscape.

---

## Repository map

```
docs/
  wiki/       LLM-wiki — the retrieval surface. Start at INDEX.md.
  specs/      Spec-driven specs (9 mandatory sections each).
  adr/        Architecture decision records.
  roadmap/    Phased plan.
  logs/       Audit trail: session, decision, risk, research, build.
research/
  raw/        Verbatim source captures — provenance for every claim.
  reports/    Per-track research reports, each ending in a GAPS section.
src/          engine/ (ingestion) · modules/ (per-network) · shared/
db/           schema, migrations, seeds
.opencode/    Agent definitions with model-ladder failover
scripts/      agents-doctor.mjs · dispatch.mjs
```

---

## Operating rules

Four hard rules, in [`AGENTS.md`](AGENTS.md):

1. **R1 — Nothing is deleted without explicit double confirmation.** Enforced on
   every agent, script and human.
2. **R2 — Never fabricate.** Mark it `UNVERIFIED` and say what you tried.
3. **R3 — Spec before code.** No implementation without an approved spec.
4. **R4 — No secrets in git.**

Only a `verifier` agent may mark a feature done, and only after exercising the
real path end to end.

---

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript · Node 22 · pnpm |
| Front-end | Next.js, **static-first HTML**, `.md` twins, llms.txt |
| Hosting | Cloudflare Pages + Workers |
| Database | SQLite in dev, Postgres-compatible schema, Postgres in prod |
| Search | Postgres full-text search |
| Shape | Monorepo, modular monolith, one deployable |

**No Docker on the development machine**, which is why SQLite is the dev default
and the schema stays Postgres-compatible: a design that cannot start locally
cannot be verified locally.

---

## Testing

Eight levels (L0–L7), detailed in [`ROADMAP.md`](docs/roadmap/ROADMAP.md#phase-3--engine-first-vertical-slice).

**L7 is the one that matters most here:** it fails the build if any page's primary
content is absent from the server-rendered HTML. The HTML-first requirement is
easy to violate silently in a refactor and impossible to notice by eye.

---

## Agent harness

Seven agents, each with a model ladder and inherited rules.

```bash
node scripts/agents-doctor.mjs              # pre-flight; refuses dispatch on failure
node scripts/dispatch.mjs --check r06       # what survived a failed run?
```

Round 1 of research lost 8/8 agents to provider rate limits with no validation
and no failover. That motivated this harness. Known limit: a model ladder
protects against per-model overload but **not** an exhausted account quota.

---

## Documentation

Bilingual by default — this README plus [`README.ru.md`](README.ru.md). Specs and
wiki pages carry English content with the project operated in Russian.

---

## Licence

See [`LICENSE`](LICENSE).

**[Русская версия →](README.ru.md)**
