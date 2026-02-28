import { describe, it, expect, beforeEach } from 'vitest'
import { keyboardShortcutManager } from '../utils/keyboard'

beforeEach(() => {
  keyboardShortcutManager.clear()
})

/**
 * Helper: create a minimal synthetic KeyboardEvent-like object.
 * In jsdom (Vitest default) we can construct real KeyboardEvent objects.
 */
function fakeKeyEvent(opts: {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: opts.key,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    metaKey: opts.metaKey ?? false,
    bubbles: true,
    cancelable: true,
  })
}

describe('KeyboardShortcutManager', () => {
  describe('register / unregister', () => {
    it('registers and fires a callback', () => {
      let called = false
      keyboardShortcutManager.register('s', () => { called = true }, { ctrl: true })
      keyboardShortcutManager.handleKeyDown(fakeKeyEvent({ key: 's', ctrlKey: true }))
      expect(called).toBe(true)
    })

    it('does not fire after unregister', () => {
      let called = false
      keyboardShortcutManager.register('s', () => { called = true }, { ctrl: true })
      keyboardShortcutManager.unregister('s', { ctrl: true })
      keyboardShortcutManager.handleKeyDown(fakeKeyEvent({ key: 's', ctrlKey: true }))
      expect(called).toBe(false)
    })
  })

  describe('handleKeyDown', () => {
    it('matches case-insensitively', () => {
      let called = false
      keyboardShortcutManager.register('s', () => { called = true })
      keyboardShortcutManager.handleKeyDown(fakeKeyEvent({ key: 'S' }))
      expect(called).toBe(true)
    })

    it('does not fire when modifier mismatch', () => {
      let called = false
      keyboardShortcutManager.register('s', () => { called = true }, { ctrl: true })
      // Press s without ctrl
      keyboardShortcutManager.handleKeyDown(fakeKeyEvent({ key: 's' }))
      expect(called).toBe(false)
    })

    it('does not fire when extra modifier is pressed', () => {
      let called = false
      keyboardShortcutManager.register('s', () => { called = true }, { ctrl: true })
      // Press Ctrl+Shift+S but binding only has ctrl
      keyboardShortcutManager.handleKeyDown(fakeKeyEvent({ key: 's', ctrlKey: true, shiftKey: true }))
      expect(called).toBe(false)
    })

    it('prevents default on match', () => {
      keyboardShortcutManager.register('s', () => {}, { ctrl: true })
      const event = fakeKeyEvent({ key: 's', ctrlKey: true })
      keyboardShortcutManager.handleKeyDown(event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('does not prevent default when no match', () => {
      const event = fakeKeyEvent({ key: 'x' })
      keyboardShortcutManager.handleKeyDown(event)
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('parseShortcut', () => {
    it('parses ctrl+s', () => {
      expect(keyboardShortcutManager.parseShortcut('ctrl+s')).toEqual({
        key: 's', ctrl: true, shift: false, alt: false, meta: false,
      })
    })

    it('parses ctrl+shift+z', () => {
      expect(keyboardShortcutManager.parseShortcut('ctrl+shift+z')).toEqual({
        key: 'z', ctrl: true, shift: true, alt: false, meta: false,
      })
    })

    it('parses cmd as meta', () => {
      expect(keyboardShortcutManager.parseShortcut('cmd+k')).toEqual({
        key: 'k', ctrl: false, shift: false, alt: false, meta: true,
      })
    })

    it('parses alt+enter', () => {
      expect(keyboardShortcutManager.parseShortcut('alt+enter')).toEqual({
        key: 'enter', ctrl: false, shift: false, alt: true, meta: false,
      })
    })

    it('handles single key without modifiers', () => {
      expect(keyboardShortcutManager.parseShortcut('escape')).toEqual({
        key: 'escape', ctrl: false, shift: false, alt: false, meta: false,
      })
    })
  })

  describe('clear / getBindings', () => {
    it('clear removes all bindings', () => {
      keyboardShortcutManager.register('a', () => {})
      keyboardShortcutManager.register('b', () => {})
      expect(keyboardShortcutManager.getBindings().length).toBe(2)
      keyboardShortcutManager.clear()
      expect(keyboardShortcutManager.getBindings()).toEqual([])
    })

    it('getBindings returns registered shortcuts', () => {
      const cb = () => {}
      keyboardShortcutManager.register('n', cb, { ctrl: true })
      const bindings = keyboardShortcutManager.getBindings()
      expect(bindings).toHaveLength(1)
      expect(bindings[0].key).toBe('n')
      expect(bindings[0].ctrl).toBe(true)
      expect(bindings[0].callback).toBe(cb)
    })
  })
})
