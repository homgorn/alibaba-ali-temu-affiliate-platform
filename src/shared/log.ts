/**
 * Minimal shared logger — the project has had a `shared/` conventions gap
 * (review finding, 2026-11-12): the README promised `shared/ logging`,
 * nothing existed. This is not a general logging framework: three levels,
 * timestamped JSON lines to stderr for warn/error, plain stderr for warn.
 * No configuration knobs until a caller needs them.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function write(level: LogLevel, msg: string): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg }) + '\n'
  if (level === 'error' || level === 'warn') process.stderr.write(line)
  else process.stdout.write(line)
}

export const log = {
  debug: (msg: string) => write('debug', msg),
  info: (msg: string) => write('info', msg),
  warn: (msg: string) => write('warn', msg),
  error: (msg: string) => write('error', msg),
}