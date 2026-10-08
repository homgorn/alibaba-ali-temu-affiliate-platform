# Operating Rules — condensed index

> **Summary:** The four hard rules that govern every action in this repo. This is
> the quick index; [`AGENTS.md`](../../AGENTS.md) is the authoritative contract
> and is **append-only**.

## R1 — Nothing is deleted without explicit double confirmation

Applies to **every** agent, script, and human.

**Never:** `rm` · `del` · `Remove-Item` · `rmdir` · `git clean` ·
`git reset --hard` · `git checkout --` · `git restore` · `gh pr/issue/repo delete`
· `DROP TABLE` · truncating a file to "start fresh".

**Required instead:** stop → list the **exact** paths → explain why → wait for
**two** confirmations: (1) the exact list, (2) explicit approval of that list.
"Clean up the repo" is **not** approval.

**Preferred alternative:** rename to `<name>.bak.<ISO8601>`. That is not deletion.

**Why:** research output, specs and decisions are unrecoverable. One bad glob
destroys hours of parallel agent work.

### Worked examples from this repo

| Situation | What was done |
|---|---|
| Mistyped path created `C:\susa ai\alibaba ai temu` (ali vs ali) | Renamed to `.bak-mistyped-path`, **not deleted**. Its one file was moved into the repo. Directory left in place awaiting operator confirmation. |
| Superseded decision D-007 | Marked `SUPERSEDED by D-008`. Row retained. |
| Risk R-015 became obsolete | Struck through with the reason and a superseding decision reference. Retained. |

---

## R2 — Never fabricate

Never invent API endpoints, field names, commission rates, legal article numbers,
or benchmark figures. Mark it `UNVERIFIED` and state what was attempted.

**Why it matters concretely:** round 1 of research found sources genuinely
contradicting each other on the AliExpress signing algorithm (MD5/HMAC vs
HMAC-SHA256). An agent picking one silently would have produced code that fails
with an opaque `IncompleteSignature` error.

**The standard this repo actually holds:**

> An honest gap is worth more than a confident guess.

[UNIT-ECONOMICS](../50-strategy-traffic/UNIT-ECONOMICS.md) contains **no EPC
figures** because none could be sourced. That page is more useful than a
plausible-looking one would have been.

---

## R3 — Spec before code

No implementation without an approved spec in `docs/specs/`. Every line traces to
an `FR-*`. Every test traces to an `AC-*`. If it is not in the spec, it does not
get built — even if it seems obviously needed.

Nine mandatory sections; a section that does not apply is written
`N/A — <reason>` so reviewers know it was considered, not forgotten.

---

## R4 — No secrets in git

API keys, app secrets, tokens, `.env` — never in code, never in commits.
`.gitignore` is configured and `agents-doctor.mjs` scans for leaks on every run.

---

## The verifier is not optional

The most common failure in agent-driven work is marking a feature complete after
unit tests pass, without ever exercising the real path.

**Only `verifier` may set `passes: true`**, and only on a **VERIFIED** verdict
with real command output as evidence. Three permitted verdicts: `VERIFIED`,
`NOT VERIFIED`, `INCONCLUSIVE`.

See [`.opencode/agents/verifier.md`](../../.opencode/agents/verifier.md).

---

## Agent harness

Seven agent definitions, each with a **model ladder** (3–5 rungs) and inherited
R1/R2/R3 rules.

```bash
node scripts/agents-doctor.mjs              # pre-flight — refuses dispatch on failure
node scripts/dispatch.mjs --track r06 --dry-run
node scripts/dispatch.mjs --check r06       # what survived a failed run?
```

**Known limit:** a model ladder protects against *per-model* overload only. It
does **not** protect against an exhausted **account** quota — round 2 proved
this, when OpenRouter-pinned agents still died on
`free-models-per-day-high-balance`. Dispatch 2–3 at a time.
