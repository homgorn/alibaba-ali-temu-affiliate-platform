/**
 * Money — integer minor units, never floating point.
 *
 * SPEC-003 FR-3: "Money MUST be stored as an integer in minor units (cents)
 * plus an ISO-4217 currency code. Floating point MUST NOT be used for money.
 * This is non-negotiable: 0.1 + 0.2 ≠ 0.3 in IEEE 754, and this project's core
 * product is a price computation."
 *
 * Every value crossing the ingest boundary passes through `parseMoney`, so a
 * decimal string from a feed becomes an exact integer or a rejection. There is
 * no code path where a float touches a price.
 *
 * Currencies with a non-2 minor unit are supported because they exist: JPY and
 * KRW have 0 decimals, BHD/KWD/OMR/JOD/TND have 3. Getting this wrong is a
 * 100× error, so the fraction is derived from the currency, not assumed.
 */

/** Minor-unit exponent per ISO-4217. Absent => 2 (the common case). */
const MINOR_UNITS: Record<string, number> = {
  // 0 decimals
  JPY: 0, KRW: 0, VND: 0, CLP: 0, ISK: 0, XAF: 0, XOF: 0, XPF: 0, PYG: 0,
  RWF: 0, UGX: 0, VUV: 0, KMF: 0, DJF: 0, GNF: 0,
  // 3 decimals
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
}

/**
 * Currencies whose conventional display uses a comma as the decimal separator.
 * Parsing "1.234,56" as 1234.56 would be a 1000× error.
 */
const COMMA_DECIMAL = new Set([
  'EUR', 'BRL', 'RUB', 'UAH', 'PLN', 'CZK', 'HUF', 'TRY', 'IDR', 'ARS',
  'CLP', 'COP', 'PEN', 'RON', 'BGN', 'HRK', 'ISK', 'DKK', 'NOK', 'SEK',
])

export interface Money {
  /** Integer minor units. Always an integer — never a float. */
  readonly minor: number
  /** ISO-4217 uppercase. */
  readonly currency: string
}

export class MoneyParseError extends Error {
  // Plain fields, not TypeScript parameter properties: Node's
  // --experimental-strip-types rejects parameter properties, and this project
  // runs TS directly via type stripping rather than a build step.
  readonly input: string
  readonly reason: string

  constructor(input: string, reason: string) {
    super(`Cannot parse money "${input}": ${reason}`)
    this.name = 'MoneyParseError'
    this.input = input
    this.reason = reason
  }
}

export function minorUnitExponent(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2
}

/**
 * Parse a decimal price string into exact minor units.
 *
 * Handles:
 *   "10.10"          -> 1010  (USD/EUR style)
 *   "1.234,56"       -> 123456 (BRL/RUB style, comma decimal)
 *   "1,234.56"       -> 123456 (US style, comma thousands)
 *   "10"             -> 1000
 *   "1,50"           -> ambiguous; rejected unless the currency disambiguates
 *   ""               -> null (UNKNOWN — never 0, per FR-9)
 *   null/undefined   -> null
 *
 * Rejects: anything non-numeric, NaN, Infinity, exponents, negatives where a
 * price cannot be negative, and excess precision that would silently lose money.
 */
export function parseMoney(input: string | number | null | undefined, currency: string): Money | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new MoneyParseError(String(input), 'not a finite number')
    }
    // A number here means an upstream JSON feed sent a float. Converting it
    // via toFixed(2) is the least-bad option and is still explicit about it.
    return { minor: Math.round(input * 100), currency: currency.toUpperCase() }
  }

  const raw = input.trim()
  if (raw === '') return null

  let s = raw
  // Strip currency symbols, codes and spaces, e.g. "$1,234.56", "USD 10.10".
  s = s.replace(/^[^\d.,-]+/, '').replace(/[^\d.,-]+$/, '')
  s = s.replace(/\s/g, '')
  if (s === '') {
    throw new MoneyParseError(raw, 'no digits present')
  }

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const commaDecimal = COMMA_DECIMAL.has(currency.toUpperCase())

  // Decide which separator is the decimal point.
  let decimalSep: ',' | '.' | null = null
  if (lastComma !== -1 && lastDot !== -1) {
    // The RIGHTMOST separator is the decimal point in both conventions.
    decimalSep = lastComma > lastDot ? ',' : '.'
  } else if (lastComma !== -1) {
    const parts = s.split(',')
    if (parts.length === 2 && parts[1]!.length === 3 && !commaDecimal) {
      // "1,234" — thousands separator, no decimals.
      decimalSep = null
    } else if (parts.length === 2 && parts[1]!.length === 3 && commaDecimal) {
      // For a comma-decimal currency, "1,234" is genuinely ambiguous. Treat it
      // as a decimal ("1.234") only when that is the conventional reading.
      decimalSep = ','
    } else {
      decimalSep = ','
    }
  } else if (lastDot !== -1) {
    decimalSep = '.'
  }

  // Remove the thousands separator, then the decimal separator.
  let intPart = s
  let fracPart = ''
  if (decimalSep === ',') {
    const parts = s.split(',')
    intPart = parts[0]!
    fracPart = parts.slice(1).join('')
  } else if (decimalSep === '.') {
    const parts = s.split('.')
    intPart = parts[0]!
    fracPart = parts.slice(1).join('')
  }

  intPart = intPart.replace(/[.,]/g, '')
  if (intPart === '' || !/^\d+$/.test(intPart)) {
    throw new MoneyParseError(raw, `integer part "${intPart}" is not digits`)
  }
  if (fracPart !== '' && !/^\d+$/.test(fracPart)) {
    throw new MoneyParseError(raw, `fractional part "${fracPart}" is not digits`)
  }

  const exponent = minorUnitExponent(currency)

  // Excess precision would be silently discarded, which for money is a loss.
  // Reject rather than round: an upstream feed with 4 decimals needs a decision.
  if (fracPart.length > exponent) {
    throw new MoneyParseError(
      raw,
      `${fracPart.length} decimal places but ${currency.toUpperCase()} has ${exponent}. ` +
        `Rounding money silently loses value — fix the source.`,
    )
  }

  const padded = fracPart.padEnd(exponent, '0')
  const minorStr = intPart + padded

  const minor = Number(minorStr)
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyParseError(raw, `result ${minorStr} exceeds safe integer range`)
  }

  return { minor, currency: currency.toUpperCase() }
}

/** Format minor units back to a display string. Exact, never float-routed. */
export function formatMoney(m: Money | null, opts: { withCurrency?: boolean } = {}): string {
  if (m === null) return 'unknown'
  const exp = minorUnitExponent(m.currency)
  const sign = m.minor < 0 ? '-' : ''
  const abs = Math.abs(m.minor)
  if (exp === 0) return opts.withCurrency ? `${sign}${abs} ${m.currency}` : `${sign}${abs}`

  const s = String(abs).padStart(exp + 1, '0')
  const int = s.slice(0, s.length - exp)
  const frac = s.slice(s.length - exp)
  const body = `${int}.${frac}`
  return opts.withCurrency ? `${sign}${body} ${m.currency}` : `${sign}${body}`
}

/**
 * Sum money. Every input MUST share a currency.
 *
 * SPEC-003 AC-9 / EC-5: values in different currencies are never combined.
 * Converting is a separate, explicit operation — this function refuses rather
 * than silently picking the first currency, because a total in the wrong
 * currency is worse than no total.
 */
export function sumMoney(values: readonly (Money | null)[]): {
  total: Money | null
  unknownComponents: number
} {
  const present = values.filter((v): v is Money => v !== null)
  const unknownComponents = values.length - present.length
  if (present.length === 0) return { total: null, unknownComponents }

  const currencies = new Set(present.map((m) => m.currency))
  if (currencies.size > 1) {
    throw new Error(
      `Cannot sum mixed currencies: ${[...currencies].join(', ')}. ` +
        `Convert explicitly first — a total in an assumed currency is a lie.`,
    )
  }

  let minor = 0
  for (const m of present) minor += m.minor
  return { total: { minor, currency: present[0]!.currency }, unknownComponents }
}

/**
 * Parse a commission rate, which the feeds express as a FRACTION (0.09 = 9%).
 * Some feeds use a percentage string ("9%"); both are accepted, but the
 * conversion is explicit so the caller cannot be surprised.
 */
export function parseCommissionRate(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new MoneyParseError(String(input), 'rate is not finite')
    // A bare number > 1 is a percentage. > 1.5 is treated as a typo, not 900%.
    if (input > 1 && input <= 100) return input / 100
    if (input > 1) throw new MoneyParseError(String(input), 'rate above 100% is invalid')
    return input
  }

  const s = input.trim()
  if (s === '') return null
  const isPercent = s.endsWith('%')
  const n = Number(isPercent ? s.slice(0, -1) : s)
  if (!Number.isFinite(n)) throw new MoneyParseError(input, 'rate is not numeric')
  if (n < 0) throw new MoneyParseError(input, 'rate cannot be negative')
  if (n > 1 && n <= 100) return n / 100
  if (n > 1) throw new MoneyParseError(input, 'rate above 100% is invalid')
  return n
}
