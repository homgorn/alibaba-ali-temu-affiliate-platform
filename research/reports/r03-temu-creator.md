# R03 — Temu: Does Programmatic Access Exist?

> **Status: ANSWERED (negative).** Both agent attempts died on provider quota;
> the orchestrator completed this track by direct HTTP fetch of the official
> partner entry points.
>
> **Conclusion: no public Temu affiliate API or developer portal was found.** Temu
> should not be built as a feed-backed module. Confidence **7/10**.

---

## Evidence (HARD FACT)

Two official Temu partner entry points were fetched 2026-10-08:

| URL | HTTP | Bytes | Extractable content |
|---|---|---|---|
| `https://partner.temu.com/` | 200 | **702 b** | `"You need to enable JavaScript to run this app."` |
| `https://www.temu.com/temu-partner.html` | 200 | **2,889 b** | **none** — JS-rendered or empty shell |

**Interpretation.** Both endpoints return a JavaScript application shell with no
server-rendered content. No developer documentation, no endpoint catalogue, no
SDK, no authentication documentation, and no rate-limit information was
discoverable at either address.

**Classification:** HARD FACT as a **negative finding** — the absence of a
publicly documented API surface is itself the finding.

## Confidence calibration

| Claim | Confidence | Why |
|---|---|---|
| No *public developer documentation* exists | **7/10** | Both official partner URLs checked and found to be JS-only shells; no docs surfaced via any reachable path |
| No API exists *at all* | **4/10** | A private, invite-only, or creator-dashboard-only API could exist and would not be publicly discoverable. Absence of evidence, not evidence of absence |
| Commission / cookie / payout terms | **2/10** | **Not obtained.** `partner.temu.com` yielded no terms text |

---

## What was NOT done, deliberately

This track was scoped to document real mechanisms operators use, **including
grey ones, each labelled with its ToS status**. That work was **not completed**,
because:

1. The commission/terms pages are behind the JS shell and could not be read.
2. Producing a catalogue of scraping and automation techniques from memory, with
   no ability to quote the governing ToS clause, would be exactly the fabrication
   R2 forbids — and it would be a document nobody should action without verifying
   it.

**This is recorded as an open gap, not silently dropped.** Re-running this track
with a headless browser (which would resolve both the terms and the CJ/Awin doc
gaps G21 and G24) is the correct fix.

---

## Strategic recommendation

**Do not build a Temu module.** Three options, ranked:

### 1. Curated content source (RECOMMENDED)

Treat Temu as something a **person** browses and a **person** curates; the
platform publishes. The feed is human-made CSV, using exactly the ingestion
interface already specified in `SPEC-001`.

- Honest about the constraint — no scraping, no ToS exposure.
- Uses infrastructure that is being built anyway for AliExpress.
- Slower and less scalable, but it is the only option that is clearly compliant.
- Value to the user is unchanged: curated finds with honest landed-cost framing
  is still useful.

### 2. Drop Temu entirely

Defensible. Nothing in the roadmap depends on it. If operator bandwidth is the
constraint, this is the cheapest choice and loses very little.

### 3. Grey mechanisms (REJECTED)

Automation, internal-endpoint access, browser-automation scraping. **Rejected on
principle, not merely deferred:** the project is a real business under a real
legal entity, and a platform whose foundation is a ToS violation is one platform
policy change away from losing everything. R1's sibling principle applies: a
shortcut that is cheap now and unrecoverable later is not a shortcut.

---

## Implication for the architecture

Temu reinforces the decision already made (D-014): **the ingestion engine must
treat every source behind one interface, including manual CSV.** A network with
no API is a configuration change, not an architectural fork. If only AliExpress
had been built against its live API, Temu — or any curatable marketplace — would
have required a separate code path.

**This is the strongest argument yet for the CSV-first approach**, arrived at from
evidence rather than convenience.

---

## GAPS

| # | Gap | Resolution path |
|---|---|---|
| **G24** | Temu creator programme terms (commission, cookie, payout, KYC) | Headless-browser fetch of `partner.temu.com` |
| **G30** | Whether a private/creator-only API exists | Requires joining the programme |
| **G31** | Which third-party sites already curate or mirror Temu products | `websearch` when available — competitive landscape for R7 |

---

## Method note

Both agent dispatches for this track failed with
`free-models-per-day-high-balance`. `websearch` returned
"No search results found" for every query. This track was completed by direct
HTTP fetch of the official Temu partner URLs, which was sufficient to answer the
primary question — because the primary question was an **existence** question,
and existence is confirmable by a small number of targeted requests.

That is worth noting for the methodology: **negative/existence questions survive
tool degradation; quantitative questions do not.** R05 and R6 are quantitative and
are correspondingly incomplete.
