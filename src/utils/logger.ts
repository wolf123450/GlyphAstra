/**
 * Structured logger — replaces scattered console.log/warn/error calls.
 *
 * Usage:
 *   import { logger } from '@/utils/logger'
 *   logger.info('Storage', 'Saved story', storyId)
 *   logger.warn('Settings', 'Validation failed — using defaults')
 *   logger.error('FS', 'Error reading file', filePath, error)
 *
 * Log level can be changed at runtime:
 *   logger.level = 'warn'   // suppress info/debug messages
 *
 * In production Tauri builds, log calls are also written to the OS log file
 * via @tauri-apps/plugin-log (AppData/…/logs/glyphastra.log on Windows).
 * The console call signature is unchanged so all existing tests pass.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug:  0,
  info:   1,
  warn:   2,
  error:  3,
  silent: 4,
}

/** True when running inside a Tauri webview. */
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// ── Plugin integration ───────────────────────────────────────────────────────
// Only loaded in production Tauri builds; harmless no-op elsewhere.

type PluginLog = {
  debug: (msg: string) => Promise<void>
  info:  (msg: string) => Promise<void>
  warn:  (msg: string) => Promise<void>
  error: (msg: string) => Promise<void>
}

let _plugin: PluginLog | null = null

if (!import.meta.env.DEV && isTauri) {
  // Eagerly start loading so the plugin is ready before the first onMounted.
  import('@tauri-apps/plugin-log')
    .then(p => { _plugin = p as unknown as PluginLog })
    .catch(() => { /* plugin unavailable – console-only fallback is fine */ })
}

/** Serialize args to a single string for the log file. */
function serialize(tag: string, args: unknown[]): string {
  return `[${tag}] ` + args.map(a =>
    a instanceof Error      ? (a.stack ?? a.message) :
    typeof a === 'object' && a !== null ? JSON.stringify(a) :
    String(a)
  ).join(' ')
}

// ── Logger class ─────────────────────────────────────────────────────────────

class Logger {
  level: LogLevel = import.meta.env.DEV ? 'debug' : 'info'

  debug(tag: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[this.level] > LEVEL_ORDER.debug) return
    console.debug(`[${tag}]`, ...args)
    _plugin?.debug(serialize(tag, args)).catch(() => {})
  }

  info(tag: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[this.level] > LEVEL_ORDER.info) return
    console.log(`[${tag}]`, ...args)
    _plugin?.info(serialize(tag, args)).catch(() => {})
  }

  warn(tag: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[this.level] > LEVEL_ORDER.warn) return
    console.warn(`[${tag}]`, ...args)
    _plugin?.warn(serialize(tag, args)).catch(() => {})
  }

  error(tag: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[this.level] > LEVEL_ORDER.error) return
    console.error(`[${tag}]`, ...args)
    _plugin?.error(serialize(tag, args)).catch(() => {})
  }
}

/** Singleton logger instance. */
export const logger = new Logger()
