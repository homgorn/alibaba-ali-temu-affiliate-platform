/**
 * Independent verification of F002 — bilingual README.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string): boolean {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
  return ok
}

const en = readFileSync(join(ROOT, 'README.md'), 'utf8')
const ru = readFileSync(join(ROOT, 'README.ru.md'), 'utf8')

check('F002  README.md exists', en.length > 100, `${en.length} chars`)
check('F002  README.ru.md exists', ru.length > 100, `${ru.length} chars`)
check('F002  EN links to RU', /README\.ru\.md/.test(en), 'link found')
check('F002  RU links to EN', /README\.md/.test(ru), 'link found')
check('F002  North star stated in EN', /first real commission/i.test(en), 'found')
check('F002  North star stated in RU', /первая реальная комиссия/i.test(ru), 'found')
check('F002  Stack listed in EN', /TypeScript|Node 22|Next\.js|Cloudflare|SQLite/.test(en), 'found')
check('F002  Stack listed in RU', /TypeScript|Node 22|Next\.js|Cloudflare|SQLite/.test(ru), 'found')
check('F002  Links to roadmap in EN', /ROADMAP\.md/.test(en), 'found')
check('F002  Links to roadmap in RU', /ROADMAP\.md/.test(ru), 'found')
check('F002  Links to wiki INDEX in EN', /INDEX\.md/.test(en), 'found')
check('F002  Links to wiki INDEX in RU', /INDEX\.md/.test(ru), 'found')

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)