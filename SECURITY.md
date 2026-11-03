# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| main (latest) | ✅ |
| Older branches | ❌ |

## Reporting a vulnerability

**Do not open a public issue.**

Email: `security@homgorn.example.com` (replace with real contact)

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected component (ingestion, API, schema, auth, etc.)
- Suggested fix if known

We will acknowledge within 48 hours and coordinate disclosure.

## What this project protects

| Asset | Protection |
|-------|------------|
| Affiliate API credentials | Never in git (`.env` gitignored, R4) |
| User click/attribution data | No raw IP stored (SPEC-005 NFR-5), channel required |
| Commission records | Immutable append-only, reconciliation against network |
| Price observations | Integer minor units (SPEC-003 FR-3), no float corruption |
| Safety exclusions | Hard-excluded at ingest, never in catalogue, audit-logged |

## Threat model

See `docs/adr/ADR-003-database.md` and `docs/logs/RISK_LOG.md` (R-016, R-018, R-020).

Key mitigations:
- **No GitHub Actions** — CI runs locally via pre-push hook (billing lock)
- **Branch protection** — 1 review required, no force-push, no deletions
- **No admin bypass** — `enforce_admins: false` is documented as R-019; direct pushes run pre-push gate
- **Secrets** — `.env` gitignored, `.env.example` has only placeholder URLs
- **Dependencies** — minimal, `node:sqlite` (stdlib), no native bindings

## Security-relevant files

| File | Purpose |
|------|---------|
| `.env.example` | All required env vars with `GET IT AT` URLs |
| `src/engine/ingest/safety.ts` | Safety exclusion logic (D-031 derivational stemming) |
| `src/engine/module.ts` | `ModuleContract` + `assertValidContract` (EC-9/FR-15) |
| `db/migrations/` | Schema with retention policies, FK constraints |
| `scripts/verify-f*.ts` | Independent verifiers — fail if evidence missing |

## Out of scope

- Cloudflare Workers/Pages security (provider responsibility)
- AliExpress/Amazon API security (provider responsibility)
- User browser security (static HTML, no client JS for content)

## Disclosure timeline

1. Day 0 — Report received, acknowledged
2. Day 1-7 — Triage, reproduce, assess severity
3. Day 7-30 — Fix developed, tested, verified
4. Day 30 — Coordinated disclosure (or sooner if exploited)