# LOG PROTOCOL

This directory is the audit trail of the project. It exists so that any future
session — human or agent — can reconstruct *why* things are the way they are
without re-litigating them, and so that a claim can be traced back to the source
that justified it.

## Files

| File | Appended when | Row/block shape |
|---|---|---|
| `SESSION_LOG.md` | Every working session ends | date · who · what changed · what was decided · what is next |
| `DECISION_LOG.md` | A decision is made | ID · date · decision · why · alternatives rejected · evidence · status |
| `RESEARCH_LOG.md` | A research round completes | round · question · tracks · verdict · confidence · gaps |
| `BUILD_LOG.md` | A feature changes state | feature ID · spec · state · verifier · evidence |
| `RISK_LOG.md` | A risk is identified or resolved | ID · risk · severity · likelihood · mitigation · owner · status |

## Rules

1. **Append-only.** History is never rewritten. A correction is a new entry that
   references the old ID. (Exception: correcting a typo in an entry made minutes
   ago in the same session — note it inline with `[fixed]`.)
2. **Cite evidence.** Any entry containing a non-obvious fact cites its
   `research/raw/<track>/NNN-slug.md` capture or its primary source URL.
3. **Record confidence `/10`.** Low confidence is a legitimate, first-class
   result. Recording "I don't know, and here's what I tried" prevents the next
   session from redoing the same failed search.
4. **Record gaps explicitly.** If something could not be verified — a 403, a
   login wall, a JS-only page — write it down. Gaps are tasks, not noise.
5. **Never delete log entries.** See `AGENTS.md` R1. To correct the record, append.

## Conventions

- Dates: ISO 8601 (`2026-10-08`). Timestamps: UTC, `2026-10-08T14:32Z`.
- Decision IDs: `D-001`, `D-002`, … monotonic, never reused.
- Risk IDs: `R-001`, `R-002`, … (distinct from research track IDs `R1`–`R8`,
  which are always written without a hyphen to avoid collision).
- People and agents are identified explicitly so a reader knows what kind of
  judgement produced an entry.
