# Temu — Programmatic Access

> **Summary:** **No public Temu affiliate API or developer portal exists.** Both
> official partner entry points return JavaScript application shells with no
> server-rendered content. Temu should therefore **not** be built as a feed-backed
> module — treat it as a curated content source (human-in-the-loop CSV) or drop
> it. Grey scraping mechanisms were considered and **rejected on principle**, not
> merely deferred.
>
> Confidence: **7/10** for "no public API docs"; **4/10** for "no API at all"; **2/10** for commission terms (not obtained).

## Evidence (HARD FACT)

Fetched 2026-10-08:

| URL | HTTP | Bytes | Content |
|---|---|---|---|
| `partner.temu.com` | 200 | 702 | "You need to enable JavaScript to run this app." |
| `temu.com/temu-partner.html` | 200 | 2,889 | none — JS-rendered or empty |

No developer documentation, endpoint catalogue, SDK, auth documentation or rate
limits were discoverable at either address.

## What this forces

| Option | Verdict |
|---|---|
| Feed-backed module | ❌ No interface exists to build against |
| **Curated content source** | ✅ **Recommended** — person browses, person curates, platform publishes via the existing CSV interface |
| Drop entirely | ✅ Defensible — nothing depends on it |
| Grey mechanisms / scraping | ❌ **Rejected on principle** — see below |

## Why grey mechanisms are rejected, not deferred

The project's whole premise is that a user gets a real answer they could not get
elsewhere. That value is a *reputation asset*, and it is destroyed by the same
act that creates it. A platform whose foundation is a ToS violation is one policy
change away from losing the domain, the accounts, and the accumulated history at
once. The upside is small — some catalogue rows. The downside is the entire
business.

This is the same reasoning that produced R1: a cheap shortcut that is
unrecoverable later is not a shortcut.

## Architecture consequence — the strongest argument yet for CSV-first

Temu is a network with **no API**. If the engine had been built only against the
AliExpress live API, Temu — and any curatable marketplace — would need a separate
code path. Because D-014 specified one interface with CSV and API as two sources
behind it, Temu costs a configuration change rather than an architectural fork.

**Arrived at from evidence, not convenience.**

## Gaps

| # | Gap | Resolution |
|---|---|---|
| G24 | Commission/cookie/payout/KYC terms | Headless-browser fetch — page is JS-only |
| G30 | Whether a private/creator-only API exists | Requires joining the programme |
| G31 | Which sites already curate/mirror Temu | `websearch` when available |

## Method note

Both agent attempts died on `free-models-per-day-high-balance`; `websearch`
returned empty. Completed by direct fetch. Worth noting: **existence questions
survive tool degradation; quantitative questions do not.** That is exactly why
this track concluded and R06 did not.

Full detail: `research/reports/r03-temu-creator.md`
