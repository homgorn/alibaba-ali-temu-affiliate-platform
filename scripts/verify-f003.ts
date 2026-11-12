/**
 * Independent verification of F003 — LLM-wiki INDEX.md integrity.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const WIKI = join(ROOT, 'docs/wiki')
const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string): boolean {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
  return ok
}

const index = readFileSync(join(WIKI, 'INDEX.md'), 'utf8')
const wikiFiles = readdirSync(WIKI, { withFileTypes: true, recursive: true })
  .filter(e => e.isFile() && e.name.endsWith('.md'))
  .map(e => relative(WIKI, join(e.parentPath, e.name)).replace(/\\/g, '/'))

const indexLinks = [...index.matchAll(/\[.*?\]\((.*?)\)/g)].map(m => m[1]).filter(l => l.endsWith('.md'))
const indexFiles = [...new Set(indexLinks.map(l => l.replace(/^\.\//, '').replace(/^docs\/wiki\//, '')))].filter(f => !f.includes('://'))

check('F003  INDEX.md exists', index.length > 100, `${index.length} chars`)
check('F003  wiki has 11 content pages + INDEX', wikiFiles.length === 12, `${wikiFiles.length} files (${wikiFiles.filter(f => f!=='INDEX.md').length} content + INDEX)`)

// The wiki is a skeleton: INDEX links to pages that don't exist yet (marked ⏳).
// Correct invariant: every EXISTING content file IS listed in INDEX (no orphans).
// Not: every INDEX link resolves to a file.
const contentFiles = wikiFiles.filter(f => f !== 'INDEX.md')
const missingFromIndex = contentFiles.filter(f => !indexFiles.includes(f))
check('F003  zero orphans (existing files not in INDEX)', missingFromIndex.length === 0, missingFromIndex.join(', ') || 'none')

// Bonus: how many INDEX links point to existing files (transparency)
const indexLinksResolving = indexFiles.filter(f => wikiFiles.includes(f)).length
check('F003  INDEX links that resolve to existing files', indexLinksResolving > 0, `${indexLinksResolving} of ${indexFiles.length} links`)

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)
