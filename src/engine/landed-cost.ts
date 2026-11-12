/**
 * Landed-cost computation — SPEC-006 FR-1..FR-12, AC-1..AC-7.
 *
 * Pure and stateless: same inputs always produce the same output. No I/O, no
 * hidden lookups (FR-11). Every component carries its own known/unknown flag
 * (FR-2). A total is computed ONLY when every component is known (FR-3).
 *
 * Honesty contract: the result never presents an incomplete total as final.
 * `totalMinor` is null whenever any component is null, and `isComplete` is
 * false. The rendering layer (and only the rendering layer) decides how to
 * present this — it must never substitute 0 or "N/A".
 *
 * Money is integer minor units (SPEC-003 FR-3). Components in different
 * currencies are NOT summed; the result currency becomes 'MIXED' (EC-5) and
 * the total is null.
 */
export interface LandedCostComponent {
  readonly minor: number | null
  readonly currency: string
  readonly known: boolean
  readonly source: string
}

export interface LandedCostResult {
  readonly item: LandedCostComponent
  readonly shipping: LandedCostComponent
  readonly duty: LandedCostComponent
  readonly vat: LandedCostComponent
  readonly handling: LandedCostComponent
  readonly totalMinor: number | null
  readonly isComplete: boolean
  readonly included: readonly string[]
  readonly unknown: readonly string[]
  readonly currency: string
}

export interface LandedCostInput {
  readonly itemMinor: number | null
  readonly itemCurrency: string
  readonly itemSource: string
  readonly shippingMinor: number | null
  readonly shippingCurrency: string
  readonly shippingSource: string
  readonly dutyMinor: number | null
  readonly dutyCurrency: string
  readonly dutySource: string
  readonly vatMinor: number | null
  readonly vatCurrency: string
  readonly vatSource: string
  readonly handlingMinor: number | null
  readonly handlingCurrency: string
  readonly handlingSource: string
}

const COMPONENT_NAMES = ['item', 'shipping', 'duty', 'vat', 'handling'] as const

export function computeLandedCost(input: LandedCostInput): LandedCostResult {
  const components = {
    item: make(input.itemMinor, input.itemCurrency, input.itemSource),
    shipping: make(input.shippingMinor, input.shippingCurrency, input.shippingSource),
    duty: make(input.dutyMinor, input.dutyCurrency, input.dutySource),
    vat: make(input.vatMinor, input.vatCurrency, input.vatSource),
    handling: make(input.handlingMinor, input.handlingCurrency, input.handlingSource),
  }

  // EC-7: negative amounts are rejected, not stored.
  for (const name of COMPONENT_NAMES) {
    const c = components[name]
    if (c.minor !== null && c.minor < 0) {
      throw new Error(`${name} must be >= 0 (SPEC-006 EC-7), got ${c.minor}`)
    }
  }

  const included: string[] = []
  const unknown: string[] = []
  for (const name of COMPONENT_NAMES) {
    if (components[name].known) included.push(name)
    else unknown.push(name)
  }

  // All components must share a currency to sum. If they differ, the total is
  // null and the currency is reported as 'MIXED' (EC-5).
  const currencies = new Set(COMPONENT_NAMES.map((n) => components[n].currency).filter((c) => c.length > 0))
  const singleCurrency = currencies.size === 1 ? (currencies.values().next().value as string) : 'MIXED'
  const currency = singleCurrency

  const allKnown = unknown.length === 0
  const sameCurrency = currencies.size === 1

  let totalMinor: number | null = null
  if (allKnown && sameCurrency) {
    totalMinor = COMPONENT_NAMES.reduce((acc, name) => acc + (components[name].minor ?? 0), 0)
  }

  return {
    item: components.item,
    shipping: components.shipping,
    duty: components.duty,
    vat: components.vat,
    handling: components.handling,
    totalMinor,
    isComplete: totalMinor !== null,
    included,
    unknown,
    currency,
  }
}

function make(minor: number | null, currency: string, source: string): LandedCostComponent {
  return {
    minor,
    currency: currency.trim().toUpperCase() || 'USD',
    known: minor !== null,
    source: source.trim() || 'unknown',
  }
}
