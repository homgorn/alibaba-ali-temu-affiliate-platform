/**
 * ID generation.
 *
 * UUIDs are stored as TEXT (SPEC-003 FR-1 portability) and generated app-side,
 * so the same row can be written to SQLite in dev and Postgres in prod without
 * a server-side default function.
 *
 * Uses crypto.randomUUID(). Deliberately NOT a counter or a hash of the input:
 * a content-derived id would make re-ingesting the same product produce the
 * same id, which is convenient but hides a class of bug where two genuinely
 * different products collide.
 */

import { randomUUID } from 'node:crypto'

export function newId(): string {
  return randomUUID()
}

/** Deterministic id, ONLY for fixtures and tests where reproducibility matters. */
export function fixedId(seed: string): string {
  // A valid v4-shaped UUID derived from a namespace hash.
  const h = seed
    .split('')
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 2166136261)
    .toString(16)
    .padStart(8, '0')
  return `00000000-0000-4000-8000-${h.slice(0, 12).padEnd(12, '0')}`
}
