/**
 * Safety-critical category exclusion — SPEC-001 FR-20, decision D-012.
 *
 * Decision: these categories are EXCLUDED OUTRIGHT, not warned about. A safety
 * failure injures someone; a warning beside an affiliate link creates liability
 * with no offsetting benefit.
 *
 * SPEC-001 EC-11: an EMPTY exclusion list is a hard startup failure, because a
 * blank list silently disables the safety control — the worst possible failure
 * mode for a control whose entire purpose is to prevent harm.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS TOKENISED AND STEMMED RATHER THAN A REGEX
 *
 * Two failure modes, one of which is unacceptable:
 *
 *   1. UNDER-exclusion — real batteries getting through. The feed category is
 *      literally "Batteries"; the operator's keyword is "battery". The stems
 *      differ ("batter" is the shared part), so a word-boundary regex on
 *      "battery" MISSES "Batteries". This is a safety failure.
 *
 *   2. OVER-exclusion — a substring match on "battery" also kills
 *      "Batteryless Flashlight" and "Helmetless Hoodie", which are ordinary
 *      products. Over-exclusion costs revenue and user trust.
 *
 * Tokenise on non-alphanumerics, stem each token lightly, then require a token
 * to EQUAL a stemmed keyword. Equality after stemming satisfies both: plural
 * forms match, compounds like "power-bank" split into tokens that match, and
 * portmanteaus ("batteryless") do not.
 *
 * The stemming is deliberately crude. Real stemming (Porter/Snowball) would
 * introduce false matches of its own ("charger" -> "charg", pulling in
 * "charging"). This handles the actual variation in marketplace categories.
 * ---------------------------------------------------------------------------
 */

export interface SafetyConfig {
  readonly excludedCategories: readonly string[]
  /** Retained for API compatibility; tokenised matching is always used. */
  readonly wholeWordOnly?: boolean
}

export interface SafetyVerdict {
  readonly excluded: boolean
  readonly matchedKeyword: string | null
  readonly matchedCategory: string | null
  readonly reason: string | null
}

export class SafetyConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SafetyConfigError'
  }
}

export function parseSafetyConfig(raw: string | undefined | null): SafetyConfig {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)

  // EC-11 — fail loudly rather than run with protection disabled.
  if (list.length === 0) {
    throw new SafetyConfigError(
      'SAFETY_EXCLUDED_CATEGORIES is EMPTY.\n' +
        'This silently disables the safety control (decision D-012). Refusing to start.\n' +
        'Set it in .env — for example:\n' +
        '  SAFETY_EXCLUDED_CATEGORIES=battery,charger,powerbank,lithium,ppe,helmet,baby,infant\n' +
        'If you genuinely intend no exclusions, that is an operator decision that must be ' +
        'made explicitly, not by leaving a variable blank.',
    )
  }

  return { excludedCategories: list, wholeWordOnly: true }
}

/** Split on any non-alphanumeric character, lowercased. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
}

/**
 * Light, conservative stemming. Symmetric: the operator's keyword and the
 * product's own tokens go through THIS EXACT FUNCTION before being compared
 * for equality. Symmetry is the property that makes the control safe in both
 * directions at once.
 *
 * Plurals (the variation the feed actually contains):
 *   batteries -> battery   (-ies -> -y)
 *   boxes     -> box       (-es after s/x/z/ch/sh)
 *   banks      -> bank     (-s)
 *
 * Derivational endings (added after the verifier caught a real leak):
 *   charging -> charg     (-ing)
 *   charger  -> charg     (-er)
 *   charges  -> charg
 *   charged  -> charg     (-ed)
 *   charge   -> charg     (-e)
 *
 * WHY THIS EXISTS — a bug the verifier found, not a hypothetical:
 * the feed contains both "Wireless Charger Stand" and "Wireless Charging Pad".
 * With plural-only stemming their stems were `charger` and `charging`, so the
 * charging pad passed the safety gate while the charger beside it did not. A
 * charger listing that reaches a user is exactly the harm this control exists
 * to prevent, and the operator's keyword list says "charger".
 *
 * WHY COLLAPSING DOES NOT REINTRODUCE OVER-EXCLUSION:
 * over-exclusion is guarded by the *equality* test, not by how far the stem is
 * truncated. "helmetless" is not reduced to "helmet" — the suffix "-less" is
 * not in the rule set — so it stays "helmetless" and never equals "helmet".
 * Truncation only helps when both sides truncate identically, which is why the
 * rules below are length-guarded: they never shorten a word to something too
 * short to be a root, which is what would let "mate" collide with "mat".
 *
 * Residual, accepted ambiguity: derivational collapsing is not linguistics.
 * "cooker" reduces to "cook" and would be caught by a "cook" keyword. That is
 * the correct direction to err for this control — an extra excluded product
 * costs revenue, a missed one can injure someone (decision D-012).
 */
export function stem(token: string): string {
  let t = token

  // --- plural / third person -------------------------------------------------
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`
  if (t.length > 4 && t.endsWith('es') && /(?:s|x|z|ch|sh)es$/.test(t)) {
    t = t.slice(0, -2)
  } else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) {
    t = t.slice(0, -1)
  }

  // --- derivational ---------------------------------------------------------
  // Only when the remaining root is long enough to actually BE a root. Without
  // this guard "mate" -> "mat" would collide with the keyword "mat", and a
  // keyword "case" would collide with every token ending in "e".
  const MIN_ROOT = 4
  if (t.length >= 5 && t.endsWith('ing')) {
    t = undouble(t.slice(0, -3))
  } else if (t.length >= 5 && t.endsWith('ed')) {
    t = undouble(t.slice(0, -2))
  } else if (t.length >= 5 && t.endsWith('er')) {
    t = undouble(t.slice(0, -2))
  }

  // Trailing silent -e, only when enough is left to be a word.
  if (t.length >= MIN_ROOT + 1 && t.endsWith('e')) t = t.slice(0, -1)

  return t
}

/** "running" -> "runn" -> "run". Needed for "running" to equal "run". */
function undouble(root: string): string {
  const n = root.length
  if (n >= 3 && root[n - 1] === root[n - 2] && !'aeiou'.includes(root[n - 1]!)) {
    return root.slice(0, -1)
  }
  return root
}

/** Stemmed token set for a keyword, which may itself be multi-word ("power bank"). */
function keywordStems(keyword: string): string[] {
  return tokenize(keyword).map(stem)
}

function haystackStems(text: string, categoryPath: readonly string[]): string[] {
  // `text` is a single string, NOT an array. Spreading it directly would yield
  // individual characters — a subtle bug that makes title matching silently
  // never fire while category matching still works.
  return [text, ...categoryPath].flatMap((s) => tokenize(s).map(stem))
}

/**
 * True when the keyword's stem sequence appears as a CONSECUTIVE run in the
 * haystack stem list.
 *
 * Consecutive rather than "anywhere in", so the multi-word keyword "power bank"
 * does not match a title that mentions "bank" and, separately, "power".
 */
function containsRun(haystack: readonly string[], keyword: readonly string[]): boolean {
  if (keyword.length === 0 || keyword.length > haystack.length) return false

  for (let i = 0; i + keyword.length <= haystack.length; i++) {
    let matched = true
    for (let j = 0; j < keyword.length; j++) {
      if (haystack[i + j] !== keyword[j]) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}

export function matchesSafety(
  text: string,
  categoryPath: readonly string[],
  config: SafetyConfig,
): SafetyVerdict {
  const haystack = haystackStems(text, categoryPath)

  for (const keyword of config.excludedCategories) {
    const kw = keywordStems(keyword)
    if (containsRun(haystack, kw)) {
      // Attribute to the category that actually contains it, so the audit
      // record names the cause rather than only the keyword.
      const matchedCategory =
        categoryPath.find((c) => containsRun(haystackStems(c, []), kw)) ??
        categoryPath[categoryPath.length - 1] ??
        null
      return {
        excluded: true,
        matchedKeyword: keyword,
        matchedCategory,
        reason: `matched excluded category keyword "${keyword}"`,
      }
    }
  }

  return { excluded: false, matchedKeyword: null, matchedCategory: null, reason: null }
}
