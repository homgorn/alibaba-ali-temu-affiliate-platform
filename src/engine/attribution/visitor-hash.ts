/**
 * Visitor identification — SPEC-005 FR-10 / NFR-5.
 *
 * A visitor is identified only by a SALTED hash, never by a raw IP. The salt
 * must be unique per deployment: reusing one salt across sites links visitors
 * between deployments, which is itself a privacy harm.
 *
 * The algorithm is SHA-256 over `salt + ':' + ip + ':' + user-agent`. SHA-256 is
 * used because the output must be a stable, opaque identifier — not because it
 * makes the hash unreversible on a small IP space. We deliberately never log
 * the raw IP, and the salt is the only thing standing between a leaked table
 * and visitor re-identification.
 *
 * The salt is read from the environment (`VISITOR_HASH_SALT`). When it is not
 * set we generate an ephemeral salt for this process and warn loudly in dev;
 * in production the variable MUST be set, and the env validator enforces it.
 */
import { createHash, randomBytes } from 'node:crypto'

let ephemeralSalt: string | null = null

export function resolveSalt(): string {
  const fromEnv = process.env.VISITOR_HASH_SALT
  if (fromEnv && fromEnv.length >= 16) return fromEnv
  if (!ephemeralSalt) {
    ephemeralSalt = randomBytes(16).toString('hex')
    // Not an error: dev convenience. Production must set VISITOR_HASH_SALT.
    console.warn(
      '[visitor-hash] VISITOR_HASH_SALT not set (or shorter than 16 chars). ' +
        'Using an ephemeral per-boot salt — hashes will differ after a restart. ' +
        'Set VISITOR_HASH_SALT in production.',
    )
  }
  return ephemeralSalt
}

export function hashVisitor(ip: string, userAgent: string | undefined, salt = resolveSalt()): string {
  return createHash('sha256')
    .update(`${salt}:${ip}:${userAgent ?? ''}`)
    .digest('base64url')
}