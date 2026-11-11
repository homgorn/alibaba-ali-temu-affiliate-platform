import { describe, it, expect } from 'vitest'
import { computeLandedCost, type LandedCostInput } from '../../src/engine/landed-cost.ts'

function base(overrides: Partial<LandedCostInput> = {}): LandedCostInput {
  return {
    itemMinor: 1000,
    itemCurrency: 'USD',
    itemSource: 'feed',
    shippingMinor: 200,
    shippingCurrency: 'USD',
    shippingSource: 'feed',
    dutyMinor: 50,
    dutyCurrency: 'USD',
    dutySource: 'tariff-table',
    vatMinor: 200,
    vatCurrency: 'USD',
    vatSource: 'operator-config',
    handlingMinor: 0,
    handlingCurrency: 'USD',
    handlingSource: 'operator-config',
    ...overrides,
  }
}

describe('computeLandedCost (SPEC-006 FR-1..FR-12)', () => {
  it('sums all known components into the total', () => {
    const r = computeLandedCost(base())
    expect(r.totalMinor).toBe(1000 + 200 + 50 + 200 + 0)
    expect(r.isComplete).toBe(true)
    expect(r.unknown).toEqual([])
    expect(r.included).toEqual(['item', 'shipping', 'duty', 'vat', 'handling'])
  })

  it('returns total=null and isComplete=false when any component is unknown', () => {
    const r = computeLandedCost(base({ shippingMinor: null, shippingSource: 'unknown' }))
    expect(r.totalMinor).toBeNull()
    expect(r.isComplete).toBe(false)
    expect(r.unknown).toContain('shipping')
    expect(r.shipping.known).toBe(false)
    expect(r.shipping.minor).toBeNull()
  })

  it('treats 0 as a real value, not unknown (EC-2, EC-6)', () => {
    const r = computeLandedCost(base({ shippingMinor: 0, shippingSource: 'feed', vatMinor: 0, vatSource: 'feed' }))
    expect(r.shipping.known).toBe(true)
    expect(r.shipping.minor).toBe(0)
    expect(r.vat.known).toBe(true)
    expect(r.isComplete).toBe(true)
  })

  it('duty is unknown when not in the tariff table (EC-3)', () => {
    const r = computeLandedCost(base({ dutyMinor: null, dutySource: 'unknown' }))
    expect(r.duty.known).toBe(false)
    expect(r.duty.minor).toBeNull()
    expect(r.isComplete).toBe(false)
    expect(r.unknown).toContain('duty')
  })

  it('rejects negative amounts (EC-7)', () => {
    expect(() => computeLandedCost(base({ shippingMinor: -1 }))).toThrow(/shipping must be >= 0/)
    expect(() => computeLandedCost(base({ dutyMinor: -50 }))).toThrow(/duty must be >= 0/)
  })

  it('never sums components in different currencies (EC-5)', () => {
    const r = computeLandedCost(base({ shippingCurrency: 'EUR', shippingSource: 'feed' }))
    expect(r.totalMinor).toBeNull()
    expect(r.isComplete).toBe(false)
    expect(r.currency).toBe('MIXED')
  })

  it('unknown shipping gives shipping_minor null, never zero (EC-2)', () => {
    const r = computeLandedCost(base({ shippingMinor: null, shippingSource: 'unknown' }))
    expect(r.shipping.minor).toBeNull()
    expect(r.shipping.known).toBe(false)
  })

  it('is deterministic — same inputs give same output (AC-6, NFR-2)', () => {
    const a = computeLandedCost(base())
    const b = computeLandedCost(base())
    expect(a).toEqual(b)
  })

  it('all unknown gives total null and completeness false (EC-1)', () => {
    const r = computeLandedCost(base({
      itemMinor: null, shippingMinor: null, dutyMinor: null, vatMinor: null, handlingMinor: null,
      itemSource: 'unknown', shippingSource: 'unknown', dutySource: 'unknown', vatSource: 'unknown', handlingSource: 'unknown',
    }))
    expect(r.totalMinor).toBeNull()
    expect(r.isComplete).toBe(false)
    expect(r.unknown).toEqual(['item', 'shipping', 'duty', 'vat', 'handling'])
    expect(r.included).toEqual([])
  })

  it('null item price gives unknown item, never total', () => {
    const r = computeLandedCost(base({ itemMinor: null, itemSource: 'unknown' }))
    expect(r.item.known).toBe(false)
    expect(r.totalMinor).toBeNull()
    expect(r.isComplete).toBe(false)
  })

  it('completes in < 1 ms (NFR-1)', () => {
    const start = performance.now()
    for (let i = 0; i < 1000; i++) computeLandedCost(base())
    const ms = performance.now() - start
    expect(ms / 1000).toBeLessThan(1)
  })

  it('component source is recorded for transparency (FR-8)', () => {
    const r = computeLandedCost(base())
    expect(r.shipping.source).toBe('feed')
    expect(r.duty.source).toBe('tariff-table')
    expect(r.vat.source).toBe('operator-config')
  })
})