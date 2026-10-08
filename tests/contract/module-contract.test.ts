import { describe, it, expect } from 'vitest'
import { createCsvModule, assertValidContract } from '../../src/engine/csv-module.ts'
import { ContractViolation, assertValidContract as assertValid } from '../../src/engine/module.ts'
import { join } from 'node:path'
import { ROOT } from '../helpers.ts'

describe('ModuleContract (SPEC-001 §6 / FR-1)', () => {
  it('a CSV module satisfies the contract', () => {
    const m = createCsvModule({ path: join(ROOT, 'tests', 'fixtures', 'products.csv') })
    expect(() => assertValidContract(m)).not.toThrow()
    expect(m.sourceKind).toBe('file-csv')
    expect(m.capabilities.supportsProductFeed).toBe(true)
  })

  it('streams the whole CSV in batched, resumable pages', async () => {
    const m = createCsvModule({ path: join(ROOT, 'tests', 'fixtures', 'products.csv'), batchSize: 20 })
    let cursor = null as null | { offset: number }
    const seen: string[] = []
    for (;;) {
      const page = await m.fetchBatch(cursor)
      for (const r of page.records) seen.push(r.externalProductId)
      cursor = page.nextCursor as typeof cursor
      if (!cursor) break
    }
    // The fixture has 66 data rows; every one should be reachable via the contract.
    expect(seen.length).toBe(66)
    expect(new Set(seen).size).toBe(seen.length) // no duplicates
  })

  it('healthCheck reports reachable and no errors after a successful load', async () => {
    const m = createCsvModule({ path: join(ROOT, 'tests', 'fixtures', 'products.csv') })
    const h = await m.healthCheck()
    expect(h.reachable).toBe(true)
    expect(h.lastSuccessAt).not.toBeNull()
  })

  it('assertValid rejects a contract missing a retention policy (FR-15 / EC-9)', () => {
    const m = createCsvModule({ path: join(ROOT, 'tests', 'fixtures', 'products.csv') })
    const bad = { ...m, retentionPolicy: undefined } as unknown as typeof m
    expect(() => assertValid(bad)).toThrow(ContractViolation)
  })
})
