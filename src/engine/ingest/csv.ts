/**
 * CSV parsing with strict schema validation.
 *
 * SPEC-001 FR-8: "CSV ingestion MUST validate a declared schema before
 * ingesting and MUST reject the whole batch on a schema mismatch, reporting the
 * offending column and row. Partial ingestion of a malformed feed is
 * prohibited."
 *
 * EC-6: a truncated download must never ingest as a complete one. That is why
 * a row count can be declared and verified, and why an unterminated quote is a
 * hard error rather than a best-effort recovery.
 *
 * No dependency: a correct RFC-4180 parser is ~60 lines, and taking a
 * dependency for it would mean trusting its edge cases with our money data.
 */

export interface CsvRow {
  /** Column values. `__line` is reserved for the 1-based source line number. */
  readonly [key: string]: string | number
  readonly __line: number
}

/** Read a column as a string. Blank and absent both yield ''. */
export function field(row: CsvRow, name: string): string {
  const v = row[name]
  return typeof v === 'string' ? v : ''
}

export interface CsvParseOptions {
  /** Column names that MUST be present. Missing => reject the batch. */
  readonly required: readonly string[]
  /** Total expected data rows (excluding the header). Enables EC-6 detection. */
  readonly expectedRowCount?: number
}

export class CsvSchemaError extends Error {
  // Plain fields, not TS parameter properties (unsupported by Node's
  // --experimental-strip-types).
  readonly column: string | null
  readonly line: number | null

  constructor(column: string | null, line: number | null, message: string) {
    super(message)
    this.name = 'CsvSchemaError'
    this.column = column
    this.line = line
  }
}

/** RFC-4180 tokenizer: handles quoted fields, embedded commas/newlines, "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  let line = 1

  while (i < text.length) {
    const ch = text[i]!

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      if (ch === '\n') line++
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      // A quote opening mid-field is malformed: `"a"b"` is ambiguous.
      if (field !== '') {
        throw new CsvSchemaError(null, line, `Unexpected quote at line ${line}: ${field}`)
      }
      inQuotes = true
      i++
      continue
    }

    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }

    if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      line++
      i++
      continue
    }

    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      line++
      i++
      continue
    }

    field += ch
    i++
  }

  if (inQuotes) {
    // EC-6: an unterminated quote almost always means a truncated download.
    throw new CsvSchemaError(
      null,
      line,
      `Unterminated quoted field starting before line ${line}. ` +
        `This usually means a TRUNCATED download — refusing to ingest a partial feed.`,
    )
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''))
}

export function parseCsvWithSchema(text: string, opts: CsvParseOptions): CsvRow[] {
  const table = parseCsv(text)
  if (table.length === 0) {
    throw new CsvSchemaError(null, 1, 'CSV is empty — no header row')
  }

  const header = table[0]!.map((h) => h.trim())
  const dataRows = table.slice(1)

  // FR-8: reject the batch on a missing required column.
  for (const col of opts.required) {
    if (!header.includes(col)) {
      throw new CsvSchemaError(
        col,
        1,
        `Missing required column "${col}". Present: ${header.join(', ')}. ` +
          `Whole batch rejected — partial ingestion is prohibited.`,
      )
    }
  }

  // EC-6: detect a truncated download.
  if (opts.expectedRowCount !== undefined && dataRows.length !== opts.expectedRowCount) {
    throw new CsvSchemaError(
      null,
      dataRows.length + 1,
      `Expected ${opts.expectedRowCount} data rows but found ${dataRows.length}. ` +
        `This is the signature of a TRUNCATED download — refusing to ingest a partial feed.`,
    )
  }

  const out: CsvRow[] = []
  for (let r = 0; r < dataRows.length; r++) {
    const cells = dataRows[r]!
    const line = r + 2 // +1 for 0-based, +1 for the header row
    if (cells.length !== header.length) {
      throw new CsvSchemaError(
        null,
        line,
        `Row has ${cells.length} fields but the header declares ${header.length}. ` +
          `A short row usually means a truncated or mis-quoted file.`,
      )
    }
    const row: Record<string, string | number> = { __line: line }
    for (let c = 0; c < header.length; c++) {
      row[header[c]!] = (cells[c] ?? '').trim()
    }
    out.push(row as CsvRow)
  }

  return out
}
