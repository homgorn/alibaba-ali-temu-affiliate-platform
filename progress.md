# PROGRESS — Kickoff

**Date:** 2026-10-08
**Status:** Phase 0 — Research in flight. No implementation started (per SDD Rule R3).

---

## What exists right now

| Artefact | State |
|---|---|
| Repository skeleton (29 directories) | created |
| `.gitignore` (secrets, DBs, raw fetch caches) | created |
| `AGENTS.md` — operating rules, incl. R1 no-deletion | created |
| Log protocol + seed logs | created |
| LLM-wiki skeleton + `INDEX.md` | created |
| GitHub templates (EN + RU) | created |
| `.opencode/agents/` — subagent definitions | created |
| `feature_list.json` — provisional, all `passes: false` | created |
| Research tracks R1–R8 | **running in parallel** |

---

## Research round 1 — dispatched 2026-10-08

Eight parallel tracks, each saving verbatim sources to `research/raw/<track>/` and a
synthesised report to `research/reports/`.

| ID | Track | Core question |
|---|---|---|
| R1 | AliExpress Affiliate / Portals API | Does it exist, for whom, with what endpoints, limits, commission terms? |
| R2 | Alibaba.com B2B + 1688 + Taobao Union | Is there any affiliate surface an outsider can actually monetise? |
| R3 | Temu creator/affiliate | Does any API or feed exist, or is it manual only? |
| R4 | Feed & data engineering | Product identity, dedup, price history, storage sizing, search. |
| R5 | Affiliate network landscape | Which other networks (goods + services) are joinable, and which have feeds? |
| R6 | Traffic & monetization | What actually converts in 2026 for RU/CIS physical-goods affiliate; 12–18 traffic ideas. |
| R7 | Product synthesis | 15–20 genuinely useful products only possible with feed + price history. |
| R8 | Legal / tax / compliance RU-CIS | НПД vs ИП, 54-ФЗ disclosure, 152-ФЗ, trademarks, API ToS retention limits. |

### Round-1 exit criteria

1. Every track reports a `/10` confidence and an explicit list of gaps.
2. `R1` and `R3` answer the blocking question: **which APIs can we actually get
   keys for, and from which legal entity?**
3. `R4` produces sizing math that justifies the database choice.
4. `R8` produces the risk register, including any constraint that changes the
   schema (e.g. mandated data-retention windows).
5. Synthesis pass → `ROADMAP.md` + specs for Phase 1.
6. **Round 2 dispatched from round-1 findings** — the questions round 1 raises,
   plus the specific "what did we miss" list.

---

## Known blockers requiring the human

| # | Blocker | Why it cannot be solved by an agent | Needed |
|---|---|---|---|
| B1 | `gh` not authenticated | `gh auth login` is interactive | Run it in a terminal |
| B2 | Git identity unset | Cannot be guessed | `git config user.name` / `user.email` |
| B3 | Affiliate API credentials | Requires an approved account | Apply for AliExpress Affiliate (R1 will document the exact route) |
| B4 | Legal entity / tax residency | Personal financial + legal fact | Answer in questionnaire |
| B5 | Docker + Postgres absent locally | Affects dev-environment design | Decision needed; SQLite-first is the default fallback |

---

## Next actions

1. Await round-1 reports.
2. Synthesis pass → wiki population, roadmap, risk register.
3. Resolve blockers B1/B2 → create GitHub repo, push baseline.
4. Write Phase-1 specs (SDD), then implement via `loop-until-done`.
