/** Shared test helpers. */

import { join } from 'node:path'

export const ROOT = join(import.meta.dirname, '..')
export const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
