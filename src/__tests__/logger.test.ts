import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../utils/logger'
import type { LogLevel } from '../utils/logger'

let savedLevel: LogLevel

beforeEach(() => {
  savedLevel = logger.level
  // Spy on console methods
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  logger.level = savedLevel
  vi.restoreAllMocks()
})

describe('logger', () => {
  describe('output format', () => {
    it('prefixes output with [tag]', () => {
      logger.level = 'debug'
      logger.debug('MyTag', 'hello')
      expect(console.debug).toHaveBeenCalledWith('[MyTag]', 'hello')
    })

    it('passes additional arguments through', () => {
      logger.level = 'debug'
      logger.error('Tag', 'msg', 42, { key: 'val' })
      expect(console.error).toHaveBeenCalledWith('[Tag]', 'msg', 42, { key: 'val' })
    })
  })

  describe('method → console mapping', () => {
    it('debug → console.debug', () => {
      logger.level = 'debug'
      logger.debug('T', 'x')
      expect(console.debug).toHaveBeenCalledTimes(1)
    })

    it('info → console.log', () => {
      logger.level = 'debug'
      logger.info('T', 'x')
      expect(console.log).toHaveBeenCalledTimes(1)
    })

    it('warn → console.warn', () => {
      logger.level = 'debug'
      logger.warn('T', 'x')
      expect(console.warn).toHaveBeenCalledTimes(1)
    })

    it('error → console.error', () => {
      logger.level = 'debug'
      logger.error('T', 'x')
      expect(console.error).toHaveBeenCalledTimes(1)
    })
  })

  describe('level filtering', () => {
    it.each([
      ['debug', ['debug', 'info', 'warn', 'error']],
      ['info',  ['info', 'warn', 'error']],
      ['warn',  ['warn', 'error']],
      ['error', ['error']],
      ['silent', []],
    ] as [LogLevel, string[]][])(
      'at level "%s" allows: %s',
      (level, expectedMethods) => {
        logger.level = level

        logger.debug('T', 'a')
        logger.info('T', 'b')
        logger.warn('T', 'c')
        logger.error('T', 'd')

        const called = []
        if ((console.debug as ReturnType<typeof vi.fn>).mock.calls.length > 0) called.push('debug')
        if ((console.log as ReturnType<typeof vi.fn>).mock.calls.length > 0)   called.push('info')
        if ((console.warn as ReturnType<typeof vi.fn>).mock.calls.length > 0)  called.push('warn')
        if ((console.error as ReturnType<typeof vi.fn>).mock.calls.length > 0) called.push('error')

        expect(called).toEqual(expectedMethods)
      }
    )
  })

  describe('runtime level change', () => {
    it('changing level takes effect immediately', () => {
      logger.level = 'error'
      logger.warn('T', 'suppressed')
      expect(console.warn).not.toHaveBeenCalled()

      logger.level = 'warn'
      logger.warn('T', 'visible')
      expect(console.warn).toHaveBeenCalledTimes(1)
    })
  })
})
