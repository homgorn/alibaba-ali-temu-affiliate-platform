# Contributing

This project follows **Spec-Driven Development (SDD)**. No code without a spec.

## Quick start

```bash
# One-time per clone
pnpm install --frozen-lockfile
sh scripts/hooks/install.sh   # installs pre-push gate

# Daily
pnpm verify                   # typecheck + 127 tests + ledger audit
```

## Rules (from AGENTS.md)

| Rule | What it means |
|------|---------------|
| **R1** | Nothing deleted without double confirmation. `git rm` only with explicit approval. |
| **R2** | Never fabricate. Unknown = `UNVERIFIED` + what was attempted. |
| **R3** | Spec before code. Every line traces to `FR-*`; every test to `AC-*`. |
| **R4** | No secrets in git. `.env` is gitignored. |

## Workflow

1. **Issue exists** — every change starts from an issue (feature, bug, blocker)
2. **Spec approved** — for new features, SPEC-XXX must be `Approved` before implementation
3. **Branch** — `feat/<slug>`, `fix/<slug>`, `docs/<slug>`
4. **Implement** — follow the spec, write tests first (TDD encouraged)
5. **Verify** — `pnpm verify` must pass (typecheck, tests, ledger audit)
6. **PR** — one logical change, descriptive title, linked issue
7. **Review** — 1 approval required (branch protection)
7. **Merge** — squash or rebase, no force-push to `main`

## Gates

| Gate | Command | What it catches |
|------|---------|-----------------|
| Typecheck | `pnpm typecheck` | Type errors, API drift |
| Unit/Integration | `pnpm test` | 127 tests, 7 suites |
| Ledger audit | `pnpm audit:ledger` | `passes:true` without evidence |
| Pre-push | `git push` | All of the above, automatically |

## Adding a feature

1. Check `feature_list.json` for existing `FXXX`
2. If new, add entry with `passes:false`, `priority`, `category`
3. Write SPEC-XXX (9 SDD sections) in `docs/specs/`
4. Get spec approved (human or architect agent)
5. Implement behind `ModuleContract` if a new network/source
6. Write verifier `scripts/verify-fXXX.ts` (scratch DB, documented CLI)
7. Run verifier → VERDICT in `BUILD_LOG.md`
8. Update `feature_list.json`: `passes:true`, `verified_by`, `verified_at`, `evidence`
9. Run `pnpm audit:ledger` — must pass

## Verifiers

Every `passes:true` feature **must** have:
- A verifier script under `scripts/verify-fXXX.ts`
- Runs against a **scratch database** via **documented CLI** (`migrate.ts`, `ingest.ts`)
- Reads stored state through a **separate DB connection** (asserts values, not field presence)
- Appends `VERIFIED`/`NOT VERIFIED` verdict to `docs/logs/BUILD_LOG.md` **before exit**
- Exits non-zero if verdict cannot be recorded

## No GitHub Actions (currently)

GitHub Actions is billing-locked (issue #8). Gates run locally via pre-push hook.
The workflow file `.github/workflows/verify.yml` is kept for when billing is restored.

## Documentation

- `docs/wiki/` — LLM-wiki, one `.md` per topic, INDEX.md maintained
- `docs/logs/BUILD_LOG.md` — append-only, every verifier verdict
- `docs/logs/DECISION_LOG.md` — one row per decision, with alternatives
- `docs/logs/RISK_LOG.md` — open risks with severity/owner/mitigation
- `docs/roadmap/ROADMAP.md` — phased plan with test ladder

## Questions?

Open a `[FEATURE]` or `[BUG]` issue. For blockers requiring credentials/decisions, use `[BLOCKER]`.