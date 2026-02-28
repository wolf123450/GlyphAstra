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
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug:  0,
  info:   1,
  warn:   2,
  error:  3,
  silent: 4,
}

class Logger {
  level: LogLevel = import.meta.env.DEV ? 'debug' : 'warn'

  debug(tag: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[this.level] > LEVEL_ORDER.debug) return
    console.debug(`[${tag}]`, ...args)
  }

  info(tag: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[this.level] > LEVEL_ORDER.info) return
    console.log(`[${tag}]`, ...args)
  }

  warn(tag: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[this.level] > LEVEL_ORDER.warn) return
    console.warn(`[${tag}]`, ...args)
  }

  error(tag: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[this.level] > LEVEL_ORDER.error) return
    console.error(`[${tag}]`, ...args)
  }
}

/** Singleton logger instance. */
export const logger = new Logger()
