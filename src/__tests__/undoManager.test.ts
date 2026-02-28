import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  init,
  push,
  flush,
  undo,
  redo,
  clear,
  canUndo,
  canRedo,
} from '../utils/editor/undoManager'

// The module keeps state in module-level Maps, so we need to clear between tests
beforeEach(() => {
  clear('ch-1')
  clear('ch-2')
  vi.useFakeTimers()
})

describe('undoManager', () => {
  describe('init', () => {
    it('sets the baseline entry', () => {
      init('ch-1', 'hello', 5)
      expect(canUndo('ch-1')).toBe(false) // only baseline
      expect(canRedo('ch-1')).toBe(false)
    })

    it('is a no-op if already initialized', () => {
      init('ch-1', 'first', 0)
      init('ch-1', 'second', 0) // should be ignored
      expect(undo('ch-1')).toBeNull() // still only one entry
    })
  })

  describe('flush', () => {
    it('commits an entry immediately', () => {
      init('ch-1', 'v1', 0)
      flush('ch-1', 'v2', 2)
      expect(canUndo('ch-1')).toBe(true)

      const entry = undo('ch-1')
      expect(entry).toEqual({ content: 'v1', cursorPos: 0 })
    })

    it('skips duplicate content', () => {
      init('ch-1', 'same', 0)
      flush('ch-1', 'same', 0) // duplicate
      expect(canUndo('ch-1')).toBe(false)
    })

    it('truncates redo tail on new commit', () => {
      init('ch-1', 'v1', 0)
      flush('ch-1', 'v2', 2)
      flush('ch-1', 'v3', 4)
      undo('ch-1') // back to v2
      undo('ch-1') // back to v1
      flush('ch-1', 'v4', 6) // should discard v2, v3
      expect(canRedo('ch-1')).toBe(false)
    })
  })

  describe('push (debounced)', () => {
    it('commits after 500ms debounce', () => {
      init('ch-1', 'v1', 0)
      push('ch-1', 'v2', () => 2)
      expect(canUndo('ch-1')).toBe(false) // not committed yet
      vi.advanceTimersByTime(500)
      expect(canUndo('ch-1')).toBe(true)
    })

    it('debounces multiple rapid pushes to only the last', () => {
      init('ch-1', 'v1', 0)
      push('ch-1', 'v2', () => 2)
      push('ch-1', 'v3', () => 3)
      push('ch-1', 'v4', () => 4)
      vi.advanceTimersByTime(500)

      const entry = undo('ch-1')
      // Should only have v1 (baseline) since debounce means only v4 was committed
      expect(entry).toEqual({ content: 'v1', cursorPos: 0 })
      // And redo should give us v4 (the only committed push)
      const redone = redo('ch-1')
      expect(redone).toEqual({ content: 'v4', cursorPos: 4 })
    })

    it('flush() cancels pending debounced push', () => {
      init('ch-1', 'v1', 0)
      push('ch-1', 'v2-pending', () => 10)
      flush('ch-1', 'v2-flushed', 5)
      vi.advanceTimersByTime(500) // debounced push should be cancelled

      // Undo should go to v1, not have v2-pending
      const entry = undo('ch-1')
      expect(entry).toEqual({ content: 'v1', cursorPos: 0 })
    })
  })

  describe('undo / redo', () => {
    it('returns null at base', () => {
      init('ch-1', 'v1', 0)
      expect(undo('ch-1')).toBeNull()
    })

    it('returns null at tip', () => {
      init('ch-1', 'v1', 0)
      expect(redo('ch-1')).toBeNull()
    })

    it('returns null for unknown chapter', () => {
      expect(undo('nonexistent')).toBeNull()
      expect(redo('nonexistent')).toBeNull()
    })

    it('round-trips undo and redo', () => {
      init('ch-1', 'v1', 0)
      flush('ch-1', 'v2', 2)
      flush('ch-1', 'v3', 4)

      expect(undo('ch-1')).toEqual({ content: 'v2', cursorPos: 2 })
      expect(undo('ch-1')).toEqual({ content: 'v1', cursorPos: 0 })
      expect(undo('ch-1')).toBeNull()

      expect(redo('ch-1')).toEqual({ content: 'v2', cursorPos: 2 })
      expect(redo('ch-1')).toEqual({ content: 'v3', cursorPos: 4 })
      expect(redo('ch-1')).toBeNull()
    })
  })

  describe('canUndo / canRedo', () => {
    it('returns false for unknown chapters', () => {
      expect(canUndo('unknown')).toBe(false)
      expect(canRedo('unknown')).toBe(false)
    })

    it('reflects state accurately through operations', () => {
      init('ch-1', 'v1', 0)
      expect(canUndo('ch-1')).toBe(false)
      expect(canRedo('ch-1')).toBe(false)

      flush('ch-1', 'v2', 2)
      expect(canUndo('ch-1')).toBe(true)
      expect(canRedo('ch-1')).toBe(false)

      undo('ch-1')
      expect(canUndo('ch-1')).toBe(false)
      expect(canRedo('ch-1')).toBe(true)
    })
  })

  describe('clear', () => {
    it('removes a chapter\'s history', () => {
      init('ch-1', 'v1', 0)
      flush('ch-1', 'v2', 2)
      clear('ch-1')
      expect(canUndo('ch-1')).toBe(false)
      expect(undo('ch-1')).toBeNull()
    })

    it('is safe to call on non-existent chapters', () => {
      expect(() => clear('nonexistent')).not.toThrow()
    })
  })

  describe('independent chapter stacks', () => {
    it('maintains separate history per chapter', () => {
      init('ch-1', 'a1', 0)
      init('ch-2', 'b1', 0)
      flush('ch-1', 'a2', 2)
      flush('ch-2', 'b2', 2)
      flush('ch-2', 'b3', 4)

      expect(canUndo('ch-1')).toBe(true)
      expect(undo('ch-1')).toEqual({ content: 'a1', cursorPos: 0 })

      // ch-2 should be unaffected
      expect(undo('ch-2')).toEqual({ content: 'b2', cursorPos: 2 })
      expect(undo('ch-2')).toEqual({ content: 'b1', cursorPos: 0 })
    })
  })

  describe('MAX_ENTRIES cap', () => {
    it('discards oldest entries when exceeding 200', () => {
      init('ch-1', 'v0', 0)
      for (let i = 1; i <= 250; i++) {
        flush('ch-1', `v${i}`, i)
      }

      // Should be able to undo 199 times (200 entries minus 1 for current position)
      let undoCount = 0
      while (undo('ch-1') !== null) undoCount++
      expect(undoCount).toBe(199)
    })
  })
})
