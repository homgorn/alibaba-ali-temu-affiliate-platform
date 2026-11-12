/**
 * Copy apps/web/functions/ into apps/web/out/functions/ after `next build`.
 *
 * Cloudflare Pages picks up Pages Functions from the deployed directory's
 * `functions/` folder (SPEC-004 FR-10: the Link header MUST come from the
 * CDN/origin layer, not per-page markup). `output: 'export'` does not move
 * this directory, so it is copied here. Git-ignored `out/` means this is
 * regenerated on every build.
 */
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'functions')
const DST = join(ROOT, 'out', 'functions')

if (!existsSync(SRC)) {
  console.log('[cp-functions] no functions/ directory — skipped')
  process.exit(0)
}

mkdirSync(DST, { recursive: true })
cpSync(SRC, DST, { recursive: true })
console.log(`[cp-functions] copied functions/ -> out/functions/`)
