# AGENTS.md — Operating rules for this repository

> This file is the contract every agent and every human session works under.
> It is **append-only**. Never delete project-specific rules — add to them.

---

## 0. HARD RULES — NON-NEGOTIABLE

### R1. NOTHING GETS DELETED WITHOUT EXPLICIT DOUBLE CONFIRMATION

> **This rule applies to every agent, subagent, script, and human in this repo.**

- Never run `rm`, `del`, `Remove-Item`, `rmdir`, `git clean`, `git reset --hard`,
  `git checkout -- <path>`, `git restore`, `gh pr delete`, `gh issue delete`,
  `gh repo delete`, or any equivalent.
- Never truncate or blank out an existing file to "start fresh".
- Never drop or `DROP TABLE` a database without confirmation.
- If a task seems to require removing something: **stop, ask, list exactly what
  would be removed and why, and wait.** Renaming to a timestamped backup
  (`.bak.<ISO8601>`) is the preferred alternative and does **not** count as
  deletion — but still report it.
- Two confirmations are required: (1) the exact list of paths/actions, and
  (2) explicit approval of that list. "Clean up the repo" is **not** approval.
- Rationale: research output, specs and decisions are unrecoverable if lost, and
  a single wrong glob can destroy hours of parallel agent work.

### R2. NEVER FABRICATE

Do not invent API endpoints, field names, commission rates, legal article
numbers, or benchmark figures. If unverified, write `UNVERIFIED` and say what
was attempted. A recorded gap is worth more than a plausible guess — a
fabricated endpoint sends the entire engineering effort down a dead path.

### R3. SPEC BEFORE CODE

No implementation without an approved spec in `docs/specs/`. Every line of code
traces to a `FR-*` requirement. Every test traces to an `AC-*` acceptance
criterion. If it is not in the spec, it does not get built.

### R4. NO SECRETS IN GIT

Affiliate API keys, app secrets, tokens, `.env` files. `.gitignore` is already
configured; verify before every commit.

---

## 1. PROJECT MISSION

Build an affiliate-marketing platform that produces **genuine user value** and is
sustainable as a business.

- **North star:** a user gets a real answer they could not get from a search
  engine — a true landed cost, an honest price history, a fake-discount warning,
  a counterfeit-risk flag — and the business earns from the resulting decisions.
- **Anti-goal:** link dumps, thin affiliate pages, fake-discount clickbait. These
  are rejected on purpose, even where they would earn more short-term.
- **Start:** Alibaba / AliExpress / Temu. **Then:** other affiliate networks
  covering goods *and* services.

---

## 2. REPOSITORY MAP

```
docs/
  wiki/        LLM-wiki. One .md per topic + INDEX.md. The retrieval surface.
  specs/       SDD specs (9 mandatory sections). Source of truth for scope.
  adr/         Architecture Decision Records. One decision = one file.
  roadmap/     Phased plan, ordered by what unblocks the most work.
  logs/        Audit trail. See §5.
  runbooks/    Operational procedures (deploy, backfill, incident).
  diagrams/    Architecture diagrams (as .md + mermaid, diffable).
research/
  raw/<track>/ Verbatim source captures. Provenance for every claim.
  reports/     Synthesised findings, one per research track.
db/
  schema/      Canonical SQL schema. Drizzle/Prisma migrations live in src/.
  migrations/  Ordered SQL migrations.
  seeds/       Dev seed data.
src/
  engine/      Main engine: ingestion, normalisation, identity, scheduling.
  modules/     One folder per network/integration. Plugin contract.
  shared/      Types, config, logging, HTTP client, errors.
tools/         One-off scripts, scrapers, analysers.
scripts/       Repeatable operational scripts.
.opencode/     Subagent definitions + routing.
```

---

## 3. AGENT ROUTING

Spawn the narrowest agent that fits. Read-only agents must not write.

| Agent | Job | May write | Where |
|---|---|---|---|
| `explorer` | Map the codebase, answer "where is X" | no | — |
| `researcher` | Run a research track, write raw + report | yes | `research/` only |
| `architect` | Draft specs, ADRs, schema | yes | `docs/`, `db/` |
| `implementer` | Build the current feature per spec | yes | `src/`, `tools/`, `db/` |
| `verifier` | Prove a feature works end-to-end | no | — |
| `analyst` | Metrics, funnels, EPC, P&L, analytics | yes | `docs/logs/`, `reports/` |

**The `verifier` is not optional.** The most common failure in agent-driven
work is declaring a feature complete after unit tests pass without ever
exercising the real path. Only `verifier` may set `passes: true`.

### Every subagent inherits

1. **Rule R1** — no deletion without double confirmation.
2. **Rule R2** — never fabricate; mark `UNVERIFIED`.
3. Stay inside its assigned paths. Other agents work in parallel in this repo.
4. Return a short summary to the orchestrator. Do **not** paste large documents
   back into the parent conversation — write them to disk and summarise.

---

## 4. SPEC PROTOCOL (SDD)

Every spec in `docs/specs/` has all nine sections. If a section does not apply,
write `N/A — <reason>` so reviewers know it was considered, not forgotten.

1. Title & Metadata (author, date, status, reviewers)
2. Context (why, with evidence)
3. Functional Requirements (`FR-N`, RFC 2119 MUST/SHOULD/MAY)
4. Non-Functional Requirements (measurable thresholds)
5. Acceptance Criteria (`AC-N`, Given/When/Then, each referencing an `FR-*`)
6. Edge Cases (`EC-N`, covering every external dependency's failure mode)
7. API Contracts (TypeScript-style interfaces, success + error)
8. Data Models (every entity, with constraints)
9. Out of Scope (explicit exclusions, with reasons)

### Bounded autonomy — STOP and escalate when

- Scope creep beyond the spec.
- Ambiguity >30% on a requirement.
- A breaking change to an API contract, schema, or public interface.
- Anything touching auth, authorization, encryption, or PII.
- A performance threshold with no way to measure it.
- Cross-team/external dependency.

Escalations must present a **recommendation**, never an open question:

```markdown
## Escalation: <title>
**Blocked on:** FR-N
**Question:** <specific and answerable>
**Options considered:** A. … pros/cons  B. … pros/cons
**My recommendation:** <A or B, with reasoning>
**Impact of waiting:** <what is blocked>
```

---

## 5. LOG PROTOCOL

Every meaningful action appends a dated entry. Logs live in `docs/logs/`:

| File | Content |
|---|---|
| `SESSION_LOG.md` | What happened each session, who did it, what was decided. |
| `DECISION_LOG.md` | One row per decision: what, why, alternatives, evidence, outcome. |
| `RESEARCH_LOG.md` | One block per research round: question, tracks, verdict, confidence. |
| `BUILD_LOG.md` | Feature-by-feature build state against `feature_list.json`. |
| `RISK_LOG.md` | Open risks, severity, owner, mitigation, status. |

Rules:
- Append. Never rewrite history — corrections go in as new entries.
- Every claim that comes from research cites its `research/raw/**` capture.
- Confidence is recorded `/10`. Low confidence is a first-class outcome, not a
  failure to hide.

---

## 6. LLM-WIKI PROTOCOL

`docs/wiki/` is the retrieval surface for future sessions and for model context.

- One `.md` per topic, self-contained, front-loaded with a 1-3 sentence summary
  so it can be retrieved without reading the whole file.
- Facts separated from inference. Provenance on every non-obvious claim:
  `[source: research/raw/<track>/NNN-slug.md]`.
- `docs/wiki/INDEX.md` is maintained and lists every page with a one-line
  description. **Adding a page without updating INDEX.md is an incomplete task.**
- When research lands or a decision is made, update the affected wiki page in the
  same change. The wiki is never allowed to drift from the evidence.

---

## 7. GIT & GITHUB

- Branch: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `research/<slug>`.
- Commit format: Conventional Commits (`feat:`, `fix:`, `docs:`, `research:`,
  `chore:`). One logical change per commit.
- **Documentation is bilingual**: every README, spec and wiki page has an English
  and a Russian version (`README.md` / `README.ru.md` pattern). See
  `docs/BILINGUAL.md`.
- PR template requires: spec link, `AC-*` covered, verification evidence,
  R1 compliance statement.
- Never push directly to `main`. Never force-push to a shared branch.

---

## 8. DEFINITION OF DONE

A feature is done when **all** hold:

- [ ] It exists in an approved spec, and no code was written outside a spec.
- [ ] Every applicable `AC-*` has a passing test.
- [ ] Every applicable `EC-*` has a test.
- [ ] A `verifier` agent exercised the **real** path end to end — not just unit
      tests, not just a `curl` that returned 200.
- [ ] NFR thresholds have measured evidence, not assumptions.
- [ ] Affected wiki pages and `INDEX.md` are updated.
- [ ] `DECISION_LOG.md` / `BUILD_LOG.md` updated if a decision was made.
- [ ] R1 respected: nothing deleted, or deletion double-confirmed in-session.
