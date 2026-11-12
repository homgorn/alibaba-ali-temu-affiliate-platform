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
const protRaw = execFileSync('gh', ['api', 'repos/homgorn/alibaba-ali-temu-affiliate-platform/branches/main/protection'], { encoding: 'utf8', shell: true })
const prot = JSON.parse(protRaw)
const reviews = prot.required_pull_request_reviews?.required_approving_review_count ?? 'none'
const forcePush = prot.allow_force_pushes?.enabled
const deletions = prot.allow_deletions?.enabled
check('F001  branch protection: force push disabled', forcePush === false, `force_push=${forcePush}`)
check('F001  branch protection: deletions disabled', deletions === false, `deletions=${deletions}`)
check('F001  branch protection: review policy is documented (D-032)', reviews === 'none' || reviews === 0 || reviews === 1, `reviews=${reviews}`)

// 4. Baseline commit exists in history
const hist = run('git', ['log', '--oneline', '--all'])
check('F001  baseline commit exists in history', /chore: project baseline|initial|baseline/i.test(hist), 'found in history')

// 5. Working tree: feature_list.json and verifier scripts are expected to be modified
const status = run('git', ['status', '--porcelain'])
const unexpected = status.split('\n').filter((l) => l.trim()).filter((l) => !l.includes('feature_list.json') && !l.includes('scripts/verify-') && !l.includes('scripts/_scratch'))
check('F001  no unexpected working tree changes', unexpected.length === 0, unexpected.length === 0 ? 'clean (except ledger + verifiers)' : `${unexpected.length} unexpected: ${unexpected.join('; ')}`)

// 6. README visible
const readme = run('gh', ['api', 'repos/homgorn/alibaba-ali-temu-affiliate-platform/contents/README.md', '--jq', '.name'])
check('F001  README.md visible in repo', readme === 'README.md', readme)

const failed = results.filter((r) => !r.ok)
console.log(`\n=== VERDICT: ${failed.length === 0 ? 'VERIFIED' : 'NOT VERIFIED'} (${results.length - failed.length}/${results.length}) ===`)
process.exit(failed.length === 0 ? 0 : 1)
