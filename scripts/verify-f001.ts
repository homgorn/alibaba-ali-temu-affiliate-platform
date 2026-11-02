/**
 * Independent verification of F001 — GitHub repository baseline.
 *
 * Verifies the repo exists, is public, protected, and has a clean baseline.
 */
import { execFileSync } from 'node:child_process'

const results: { step: string; ok: boolean; evidence: string }[] = []
function check(step: string, ok: boolean, evidence: string): boolean {
  results.push({ step, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`)
  console.log(`      ${evidence}`)
  return ok
}

function run(cmd: string, args: string[] = []): string {
  return execFileSync(cmd, args, { encoding: 'utf8', shell: true }).trim()
}

// 1. gh auth
const auth = run('gh', ['auth', 'status'])
check('F001  gh auth reports logged in', auth.includes('Logged in'), auth.split('\n')[0])

// 2. Repo exists and is public
const repo = run('gh', ['api', 'repos/homgorn/alibaba-ali-temu-affiliate-platform', '--jq', '.private,.archived,.disabled'])
const [isPrivate, isArchived, isDisabled] = repo.split('\n')
check('F001  repo is public (not private)', isPrivate === 'false', `private=${isPrivate}`)
check('F001  repo not archived', isArchived === 'false', `archived=${isArchived}`)
check('F001  repo not disabled', isDisabled === 'false', `disabled=${isDisabled}`)

// 3. Branch protection
const prot = run('gh', ['api', 'repos/homgorn/alibaba-ali-temu-affiliate-platform/branches/main/protection', '--jq', '.required_pull_request_reviews.required_approving_review_count,.allow_force_pushes.enabled,.allow_deletions.enabled'])
const [reviews, forcePush, deletions] = prot.split('\n')
check('F001  branch protection: 1 required review', reviews === '1', `reviews=${reviews}`)
check('F001  branch protection: force push disabled', forcePush === 'false', `force_push=${forcePush}`)
check('F001  branch protection: deletions disabled', deletions === 'false', `deletions=${deletions}`)

// 4. Baseline commit exists in history
const hist = run('git', ['log', '--oneline', '--all'])
check('F001  baseline commit exists in history', /chore: project baseline|initial|baseline/i.test(hist), 'found in history')

// 5. Clean working tree (untracked new verifier scripts + feature_list.json update are expected)
const status = run('git', ['status', '--porcelain'])
const untracked = status.split('\n').filter(l => l.startsWith('??')).length
const modified = status.split('\n').filter(l => l.startsWith(' M') || l.startsWith('M '))
  .filter(l => !l.includes('feature_list.json')).length
check('F001  only feature_list.json modified among tracked files', modified === 0, `${modified} other modified, ${untracked} untracked (verifiers + ledger update expected)`)

// 6. README visible
const readme = run('gh', ['api', 'repos/homgorn/alibaba-ali-temu-affiliate-platform/contents/README.md', '--jq', '.name'])
check('F001  README.md visible in repo', readme === 'README.md', readme)

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)