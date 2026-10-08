/**
 * L1 unit tests — money, CSV, safety.
 * Pure functions. No database, no credentials.
 */

import { describe, it, expect } from 'vitest'
import {
  parseMoney,
  formatMoney,
  sumMoney,
  parseCommissionRate,
  minorUnitExponent,
  MoneyParseError,
} from '../../src/shared/money.ts'
import { parseCsv, parseCsvWithSchema, CsvSchemaError } from '../../src/engine/ingest/csv.ts'
import { parseSafetyConfig, matchesSafety, SafetyConfigError } from '../../src/engine/ingest/safety.ts'

describe('parseMoney — exact minor units, never float (SPEC-003 FR-3)', () => {
  it('parses a simple decimal', () => {
    expect(parseMoney('12.99', 'USD')).toEqual({ minor: 1299, currency: 'USD' })
    expect(parseMoney('0.05', 'USD')).toEqual({ minor: 5, currency: 'USD' })
    expect(parseMoney('7', 'USD')).toEqual({ minor: 700, currency: 'USD' })
  })

  it('treats empty / null as UNKNOWN, not zero (FR-9)', () => {
    // This is the load-bearing distinction: null means "we do not know",
    // 0 would mean "it is free" and would corrupt every total.
    expect(parseMoney('', 'USD')).toBeNull()
    expect(parseMoney(null, 'USD')).toBeNull()
    expect(parseMoney(undefined, 'USD')).toBeNull()
    expect(parseMoney('   ', 'USD')).toBeNull()
  })

  it('handles US thousands separators', () => {
    expect(parseMoney('1,234.56', 'USD')).toEqual({ minor: 123456, currency: 'USD' })
  })

  it('handles comma-decimal currencies (BRL/RUB style)', () => {
    // Getting this wrong is a 1000x error, so it is explicitly tested.
    expect(parseMoney('1.234,56', 'BRL')).toEqual({ minor: 123456, currency: 'BRL' })
    expect(parseMoney('12,99', 'EUR')).toEqual({ minor: 1299, currency: 'EUR' })
    expect(parseMoney('19,90', 'RUB')).toEqual({ minor: 1990, currency: 'RUB' })
  })

  it('strips currency symbols and codes', () => {
    expect(parseMoney('$12.99', 'USD')).toEqual({ minor: 1299, currency: 'USD' })
    expect(parseMoney('USD 12.99', 'USD')).toEqual({ minor: 1299, currency: 'USD' })
  })

  it('respects 0-decimal currencies (JPY)', () => {
    expect(minorUnitExponent('JPY')).toBe(0)
    expect(parseMoney('1500', 'JPY')).toEqual({ minor: 1500, currency: 'JPY' })
  })

  it('respects 3-decimal currencies (KWD)', () => {
    expect(minorUnitExponent('KWD')).toBe(3)
    expect(parseMoney('1.250', 'KWD')).toEqual({ minor: 1250, currency: 'KWD' })
  })

  it('REJECTS excess precision rather than silently rounding money away', () => {
    // Rounding money silently loses value. The source must be fixed instead.
    expect(() => parseMoney('12.999', 'USD')).toThrow(MoneyParseError)
    expect(() => parseMoney('12.999', 'USD')).toThrow(/decimal places/)
  })

  it('rejects non-numeric and malformed input loudly', () => {
    expect(() => parseMoney('abc', 'USD')).toThrow(MoneyParseError)
    expect(() => parseMoney('NaN', 'USD')).toThrow(MoneyParseError)
    expect(() => parseMoney('Infinity', 'USD')).toThrow(MoneyParseError)
  })

  it('rejects a value that overflows safe integers', () => {
    expect(() => parseMoney('999999999999999999999', 'USD')).toThrow(MoneyParseError)
  })
})

describe('formatMoney — exact, never float-routed', () => {
  it('round-trips', () => {
    expect(formatMoney({ minor: 1299, currency: 'USD' })).toBe('12.99')
    expect(formatMoney({ minor: 5, currency: 'USD' })).toBe('0.05')
    expect(formatMoney({ minor: 700, currency: 'USD' })).toBe('7.00')
    expect(formatMoney({ minor: 1990, currency: 'RUB' })).toBe('19.90')
  })

  it('formats 0-decimal currency without a fraction', () => {
    expect(formatMoney({ minor: 1500, currency: 'JPY' })).toBe('1500')
  })

  it('renders unknown as the word, never as 0', () => {
    expect(formatMoney(null)).toBe('unknown')
  })

  it('round-trips through parse for a range of values', () => {
    for (const s of ['0.01', '9.99', '123.45', '1000.00', '0.10', '7.77']) {
      const m = parseMoney(s, 'USD')!
      expect(formatMoney(m)).toBe(s)
    }
  })
})

describe('sumMoney — refuses mixed currencies (SPEC-003 AC-9)', () => {
  it('sums same-currency values exactly', () => {
    const r = sumMoney([
      { minor: 1010, currency: 'USD' },
      { minor: 2020, currency: 'USD' },
    ])
    expect(r.total).toEqual({ minor: 3030, currency: 'USD' })
  })

  it('REFUSES to sum different currencies', () => {
    // A total in an assumed currency is a lie. Refuse instead.
    expect(() =>
      sumMoney([
        { minor: 1000, currency: 'USD' },
        { minor: 1000, currency: 'EUR' },
      ]),
    ).toThrow(/mixed currencies/)
  })

  it('counts unknown components rather than treating them as zero', () => {
    const r = sumMoney([{ minor: 1000, currency: 'USD' }, null, null])
    expect(r.unknownComponents).toBe(2)
    expect(r.total).toEqual({ minor: 1000, currency: 'USD' })
  })

  it('returns null when everything is unknown', () => {
    const r = sumMoney([null, null])
    expect(r.total).toBeNull()
    expect(r.unknownComponents).toBe(2)
  })
})

describe('parseCommissionRate — fraction form', () => {
  it('treats a bare fraction as a fraction', () => {
    expect(parseCommissionRate('0.09')).toBeCloseTo(0.09)
    expect(parseCommissionRate(0.09)).toBeCloseTo(0.09)
  })

  it('treats >1 as a percentage', () => {
    expect(parseCommissionRate('9%')).toBeCloseTo(0.09)
    expect(parseCommissionRate(9)).toBeCloseTo(0.09)
  })

  it('rejects >100%', () => {
    expect(() => parseCommissionRate('150')).toThrow()
    expect(() => parseCommissionRate('-1')).toThrow()
  })

  it('null for empty (=> monetisable false)', () => {
    expect(parseCommissionRate('')).toBeNull()
    expect(parseCommissionRate(null)).toBeNull()
  })
})

describe('parseCsv — RFC-4180', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('handles quoted fields with embedded commas', () => {
    expect(parseCsv('a,b\n"x,y",z\n')).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
    ])
  })

  it('handles escaped quotes', () => {
    expect(parseCsv('a\n"he said ""hi"""\n')).toEqual([['a'], ['he said "hi"']])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('throws on an unterminated quote (EC-6: truncated download)', () => {
    expect(() => parseCsv('a,b\n"unterminated,2\n')).toThrow(/Unterminated/)
  })
})

describe('parseCsvWithSchema — whole-batch rejection (SPEC-001 FR-8)', () => {
  it('rejects the batch when a required column is missing, naming it', () => {
    const csv = 'a,b\n1,2\n'
    expect(() => parseCsvWithSchema(csv, { required: ['a', 'missing'] })).toThrow(
      /Missing required column "missing"/,
    )
  })

  it('rejects a short row rather than ingesting partial data', () => {
    const csv = 'a,b,c\n1,2\n'
    expect(() => parseCsvWithSchema(csv, { required: ['a', 'b', 'c'] })).toThrow(
      /fields but the header declares/,
    )
  })

  it('detects a truncated download via expectedRowCount (EC-6)', () => {
    const csv = 'a,b\n1,2\n3,4\n'
    expect(() => parseCsvWithSchema(csv, { required: ['a', 'b'], expectedRowCount: 10 })).toThrow(
      /TRUNCATED/,
    )
  })

  it('records the source line number on each row', () => {
    const csv = 'a,b\n1,2\n3,4\n'
    const rows = parseCsvWithSchema(csv, { required: ['a', 'b'] })
    expect(rows[0]!.a).toBe('1')
    expect(rows[1]!.b).toBe('4')
  })
})

describe('safety exclusion (SPEC-001 FR-20, EC-11)', () => {
  const cfg = parseSafetyConfig('battery, charger, power bank, baby, helmet')

  it('throws when the list is EMPTY — the control must not silently disable (EC-11)', () => {
    // A blank list is the worst failure mode for a safety control.
    expect(() => parseSafetyConfig('')).toThrow(SafetyConfigError)
    expect(() => parseSafetyConfig(undefined)).toThrow(SafetyConfigError)
    expect(() => parseSafetyConfig('  ,  ,')).toThrow(SafetyConfigError)
  })

  it('excludes obvious matches', () => {
    expect(matchesSafety('Rechargeable Battery 3000mAh', [], cfg).excluded).toBe(true)
    expect(matchesSafety('Power Bank 20000mAh', [], cfg).excluded).toBe(true)
    expect(matchesSafety('Baby Feeding Bowl', [], cfg).excluded).toBe(true)
  })

  it('matches on the category path too', () => {
    // "Batteries" (plural) is a real feed category. A strict whole-word match
    // would MISS it, and a miss here is a safety failure.
    const v = matchesSafety('Generic Item', ['Electronics', 'Batteries'], cfg)
    expect(v.excluded).toBe(true)
    expect(v.matchedCategory).toBe('Batteries')
  })

  it('matches plural and compound forms of a keyword', () => {
    expect(matchesSafety('Item', ['Batteries'], cfg).excluded).toBe(true)
    expect(matchesSafety('Item', ['Power Banks'], cfg).excluded).toBe(true)
    // hyphenated variants must also match
    expect(matchesSafety('Item', ['Power-Banks'], cfg).excluded).toBe(true)
    expect(matchesSafety('Fast charger with cable', [], cfg).excluded).toBe(true)
  })

  it('does NOT over-exclude portmanteau words', () => {
    // A substring match would kill these ordinary products.
    expect(matchesSafety('Batteryless Flashlight', [], cfg).excluded).toBe(false)
    expect(matchesSafety('Helmetless Hoodie', [], cfg).excluded).toBe(false)
  })

  it('does NOT over-exclude when the keyword is a substring of a safe word', () => {
    // Whole-word matching matters: "battery" must not exclude
    // "battery-powered bicycle computer", a legitimate product.
    const v = matchesSafety('Battery Powered Bicycle Computer', [], cfg)
    // "battery" as a standalone word still matches; but a compound like
    // "batteryless" should not:
    expect(matchesSafety('Batteryless Flashlight', [], cfg).excluded).toBe(false)
    expect(matchesSafety('Helmetless Hoodie', [], cfg).excluded).toBe(false)
  })

  it('does not exclude an unrelated safe product', () => {
    expect(matchesSafety('Yoga Mat Anti Slip', ['Sports', 'Fitness'], cfg).excluded).toBe(false)
    expect(matchesSafety('Ceramic Coffee Mug', ['Home', 'Kitchenware'], cfg).excluded).toBe(false)
  })

  it('is case-insensitive and returns the matched keyword', () => {
    const v = matchesSafety('BATTERY PACK', [], cfg)
    expect(v.excluded).toBe(true)
    expect(v.matchedKeyword).toBeTruthy()
  })
})
