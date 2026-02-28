import { describe, it, expect } from 'vitest'
import { computeLineDiff, charSegments, pairDelAdd, fullDiff } from '@/utils/editor/diffEngine'

// ─── helpers ────────────────────────────────────────────────────────────────

/** Flatten segments back to a plain string (for readable assertions). */
function flat(segs: { changed: boolean; text: string }[] | undefined): string {
  return (segs ?? []).map(s => s.text).join('')
}

/** Extract only the changed segments' text from a line. */
function changedText(segs: { changed: boolean; text: string }[] | undefined): string {
  return (segs ?? []).filter(s => s.changed).map(s => s.text).join('')
}

/** Extract only the unchanged segments' text from a line. */
function unchangedText(segs: { changed: boolean; text: string }[] | undefined): string {
  return (segs ?? []).filter(s => !s.changed).map(s => s.text).join('')
}

// ─── charSegments ────────────────────────────────────────────────────────────

describe('charSegments', () => {
  it('empty text returns single unchanged empty segment', () => {
    const segs = charSegments('', 'hello')
    expect(segs).toEqual([{ changed: false, text: '' }])
  })

  it('identical strings produce no changed segments', () => {
    const segs = charSegments('hello world', 'hello world')
    expect(segs.every(s => !s.changed)).toBe(true)
    expect(flat(segs)).toBe('hello world')
  })

  it('totally different strings (no shared prefix/suffix) mark entire text as changed', () => {
    const segs = charSegments('aaa', 'bbb')
    expect(segs).toEqual([{ changed: true, text: 'aaa' }])
  })

  it('prefix unchanged, suffix absent — changed middle is the right tail', () => {
    // "Hello world" → "Hello earth": shared prefix "Hello ", no shared suffix
    const segs = charSegments('Hello world', 'Hello earth')
    expect(flat(segs)).toBe('Hello world')
    expect(unchangedText(segs)).toBe('Hello ')
    expect(changedText(segs)).toBe('world')
  })

  it('suffix unchanged, prefix absent', () => {
    // "foo bar" → "baz bar": no shared prefix (f≠b), shared suffix " bar"
    const segs = charSegments('foo bar', 'baz bar')
    expect(flat(segs)).toBe('foo bar')
    expect(unchangedText(segs)).toBe(' bar')
    expect(changedText(segs)).toBe('foo')
  })

  it('char inserted into other: nothing in text is changed', () => {
    // "cat" vs "cart" — "cat" is a subsequence; prefix/suffix covers all of text
    const segs = charSegments('cat', 'cart')
    expect(segs.every(s => !s.changed)).toBe(true)
    expect(flat(segs)).toBe('cat')
  })

  it('char deleted from text: deleted char is changed', () => {
    // "cart" vs "cat" — shared prefix "ca", shared suffix "t", middle "r" is changed
    const segs = charSegments('cart', 'cat')
    expect(flat(segs)).toBe('cart')
    expect(changedText(segs)).toBe('r')
    expect(unchangedText(segs)).toBe('cat')
  })

  it('single char substitution in the middle', () => {
    // "bat" → "bit" — prefix "b", suffix "t", changed "a"
    const segs = charSegments('bat', 'bit')
    expect(flat(segs)).toBe('bat')
    expect(changedText(segs)).toBe('a')
    expect(unchangedText(segs)).toBe('bt')
  })

  it('reconstructed text always equals original', () => {
    const pairs = [
      ['The quick brown fox', 'The slow red fox'],
      ['', 'something'],
      ['something', ''],
      ['abc', 'abc'],
      ['abc', 'xyz'],
    ]
    for (const [a, b] of pairs) {
      const segs = charSegments(a, b)
      expect(flat(segs)).toBe(a)
    }
  })

  it('empty other marks whole text as changed', () => {
    const segs = charSegments('hello', '')
    expect(segs).toEqual([{ changed: true, text: 'hello' }])
  })

  it('prefix + suffix cover entire text — all unchanged', () => {
    // "abcde" vs "abXcde"  — text fully covered by shared prefix+suffix
    const segs = charSegments('abcde', 'abXcde')
    expect(segs.every(s => !s.changed)).toBe(true)
  })
})

// ─── computeLineDiff ─────────────────────────────────────────────────────────

describe('computeLineDiff', () => {
  it('identical text produces only same lines', () => {
    const lines = computeLineDiff('a\nb\nc', 'a\nb\nc')
    expect(lines.every(l => l.type === 'same')).toBe(true)
    expect(lines.map(l => l.text)).toEqual(['a', 'b', 'c'])
  })

  it('pure addition — adds a new line at end', () => {
    const lines = computeLineDiff('line1', 'line1\nline2')
    expect(lines).toContainEqual({ type: 'same', text: 'line1' })
    expect(lines).toContainEqual({ type: 'add',  text: 'line2' })
    expect(lines.some(l => l.type === 'del')).toBe(false)
  })

  it('pure deletion — removes a line', () => {
    const lines = computeLineDiff('line1\nline2', 'line1')
    expect(lines).toContainEqual({ type: 'same', text: 'line1' })
    expect(lines).toContainEqual({ type: 'del',  text: 'line2' })
    expect(lines.some(l => l.type === 'add')).toBe(false)
  })

  it('line replacement emits del + add', () => {
    const lines = computeLineDiff('hello', 'world')
    expect(lines.some(l => l.type === 'del' && l.text === 'hello')).toBe(true)
    expect(lines.some(l => l.type === 'add' && l.text === 'world')).toBe(true)
  })

  it('correctly identifies unchanged context lines', () => {
    const base = 'line1\nline2\nline3'
    const cmp  = 'line1\nchanged\nline3'
    const lines = computeLineDiff(base, cmp)
    const types = lines.map(l => l.type)
    expect(lines.find(l => l.type === 'same' && l.text === 'line1')).toBeTruthy()
    expect(lines.find(l => l.type === 'same' && l.text === 'line3')).toBeTruthy()
    expect(types).toContain('del')
    expect(types).toContain('add')
  })

  it('empty base → del of empty line + add lines for each content line', () => {
    // ''.split('\n') = [''] so there is one empty base line
    const lines = computeLineDiff('', 'a\nb')
    expect(lines.some(l => l.type === 'del' && l.text === '')).toBe(true)
    expect(lines.some(l => l.type === 'add' && l.text === 'a')).toBe(true)
    expect(lines.some(l => l.type === 'add' && l.text === 'b')).toBe(true)
  })

  it('empty comparison → del lines for each base line + add of empty line', () => {
    const lines = computeLineDiff('a\nb', '')
    expect(lines.some(l => l.type === 'del' && l.text === 'a')).toBe(true)
    expect(lines.some(l => l.type === 'del' && l.text === 'b')).toBe(true)
    expect(lines.some(l => l.type === 'add' && l.text === '')).toBe(true)
  })
})

// ─── pairDelAdd ──────────────────────────────────────────────────────────────

describe('pairDelAdd', () => {
  it('unchanged line passes through untouched', () => {
    const input = [{ type: 'same' as const, text: 'hello' }]
    expect(pairDelAdd(input)).toEqual(input)
  })

  it('pure addition has no del side emitted', () => {
    const raw = computeLineDiff('first line', 'first line\nsecond line')
    const out = pairDelAdd(raw)
    expect(out.some(l => l.type === 'del')).toBe(false)
    expect(out.some(l => l.type === 'add' && l.text === 'second line')).toBe(true)
  })

  it('pure deletion has no add side emitted', () => {
    const raw = computeLineDiff('first line\nsecond line', 'first line')
    const out = pairDelAdd(raw)
    expect(out.some(l => l.type === 'add')).toBe(false)
    expect(out.some(l => l.type === 'del' && l.text === 'second line')).toBe(true)
  })

  it('inline pure deletion: add side emitted with a zero-width marker at deletion point', () => {
    // "Sentence one. Sentence two." → "Sentence one."  (sentence deleted from end)
    const raw = computeLineDiff('Sentence one. Sentence two.', 'Sentence one.')
    const out = pairDelAdd(raw)
    const del = out.find(l => l.type === 'del')!
    const add = out.find(l => l.type === 'add')!
    // del side should highlight the removed text
    expect(changedText(del.segments)).toBe(' Sentence two.')
    // add side should be present with a marker (changed: true, text: '')
    expect(add).toBeTruthy()
    const marker = add.segments?.find(s => s.changed && s.text === '')
    expect(marker).toBeTruthy()
    // flat of segments still reconstructs the original add line text
    expect(flat(add.segments)).toBe('Sentence one.')
  })

  it('inline pure deletion from middle: marker placed at correct position', () => {
    // "Hello world today" → "Hello today"  (word deleted from middle)
    const raw = computeLineDiff('Hello world today', 'Hello today')
    const out = pairDelAdd(raw)
    const add = out.find(l => l.type === 'add')!
    expect(add).toBeTruthy()
    // flat reconstructs add line
    expect(flat(add.segments)).toBe('Hello today')
    // prefix before marker should be "Hello "
    const segs = add.segments!
    const markerIdx = segs.findIndex(s => s.changed && s.text === '')
    expect(markerIdx).toBeGreaterThan(-1)
    const textBeforeMarker = segs.slice(0, markerIdx).map(s => s.text).join('')
    expect(textBeforeMarker).toBe('Hello ')
  })

  it('modified line: both del and add emitted with segments', () => {
    const raw = computeLineDiff('Hello world', 'Hello earth')
    const out = pairDelAdd(raw)
    const del = out.find(l => l.type === 'del')
    const add = out.find(l => l.type === 'add')
    expect(del).toBeTruthy()
    expect(add).toBeTruthy()
    expect(del!.segments).toBeTruthy()
    expect(add!.segments).toBeTruthy()
  })

  it('modified line: only differing chars are marked changed', () => {
    const raw = computeLineDiff('Hello world', 'Hello earth')
    const out = pairDelAdd(raw)
    const del = out.find(l => l.type === 'del')!
    const add = out.find(l => l.type === 'add')!
    expect(changedText(del.segments)).toBe('world')
    expect(unchangedText(del.segments)).toBe('Hello ')
    expect(changedText(add.segments)).toBe('earth')
    expect(unchangedText(add.segments)).toBe('Hello ')
  })

  it('segments reconstruct full original line text', () => {
    const raw = computeLineDiff('The quick brown fox', 'The slow red fox')
    const out = pairDelAdd(raw)
    for (const line of out) {
      if (line.segments) {
        expect(flat(line.segments)).toBe(line.text)
      }
    }
  })

  it('isolated del lines with no following add are fully highlighted', () => {
    // Whole-line deletions should highlight the entire line text
    const lines = [
      { type: 'del' as const, text: 'line a' },
      { type: 'del' as const, text: 'line b' },
    ]
    const out = pairDelAdd(lines)
    expect(out.every(l => l.segments !== undefined)).toBe(true)
    expect(out.every(l => l.segments!.every(s => s.changed))).toBe(true)
  })

  it('isolated add line with no preceding del is fully highlighted', () => {
    const lines = [{ type: 'add' as const, text: 'brand new line' }]
    const out = pairDelAdd(lines)
    expect(out[0].segments).toBeDefined()
    expect(out[0].segments!.every(s => s.changed)).toBe(true)
  })
})

// ─── fullDiff (end-to-end) ────────────────────────────────────────────────────

describe('fullDiff', () => {
  it('no changes → all same', () => {
    const out = fullDiff('paragraph one\nparagraph two', 'paragraph one\nparagraph two')
    expect(out.every(l => l.type === 'same')).toBe(true)
  })

  it('word replacement in the middle of a line shows correct segments', () => {
    // "walked" → "ran" — no shared prefix (w≠r), no shared suffix (d≠n), but " slowly" ≠ " quickly"
    // shared prefix "She ", shared suffix "."... actually: "She walked slowly." vs "She ran quickly."
    // prefix: "She " (4 chars match), suffix: "." (1 char matches)... wait
    // "She walked slowly." — ends in "ly."
    // "She ran quickly." — ends in "ly."
    // suffix: '.', 'y', 'l' → 3 chars from end match
    // So del changed = "walked slow", add changed = "ran quick"
    const out = fullDiff('She walked slowly.', 'She ran quickly.')
    const del = out.find(l => l.type === 'del')
    const add = out.find(l => l.type === 'add')
    expect(del).toBeTruthy()
    expect(add).toBeTruthy()
    expect(flat(del!.segments)).toBe('She walked slowly.')
    expect(flat(add!.segments)).toBe('She ran quickly.')
    // Both share "She " prefix and "ly." suffix
    expect(unchangedText(del!.segments)).toBe('She ly.')
    expect(changedText(del!.segments)).toBe('walked slow')
  })

  it('appended text: only add lines, no del', () => {
    const out = fullDiff('first paragraph.', 'first paragraph.\n\nSecond paragraph.')
    expect(out.some(l => l.type === 'del')).toBe(false)
    expect(out.some(l => l.type === 'add')).toBe(true)
  })

  it('deleted text: only del lines, no add', () => {
    const out = fullDiff('first paragraph.\n\nSecond paragraph.', 'first paragraph.')
    expect(out.some(l => l.type === 'add')).toBe(false)
    expect(out.some(l => l.type === 'del')).toBe(true)
  })

  it('wholly deleted line is entirely brightly highlighted', () => {
    // A sentence on its own line deleted — should produce a del line where ALL
    // segments are changed (no muted text anywhere on that line)
    const out = fullDiff(
      'Opening line.\nThis sentence was removed.\nClosing line.',
      'Opening line.\nClosing line.',
    )
    const del = out.find(l => l.type === 'del' && l.text === 'This sentence was removed.')
    expect(del).toBeTruthy()
    expect(del!.segments).toBeDefined()
    expect(del!.segments!.every(s => s.changed)).toBe(true)
  })

  it('sentence ADDED to end of line: del side should have NO bright chars (nothing was removed)', () => {
    // base has no extra sentence; comparison adds one → del side ("base") changed nothing
    const base = 'The quick brown fox jumps over the lazy dog.'
    const cmp  = 'The quick brown fox jumps over the lazy dog. This sentence was added.'
    const out  = fullDiff(base, cmp)
    const del  = out.find(l => l.type === 'del')!
    const add  = out.find(l => l.type === 'add')!
    expect(del).toBeTruthy()
    expect(add).toBeTruthy()
    // del side: nothing was removed — entire text is unchanged (dim)
    expect(changedText(del.segments)).toBe('')
    expect(unchangedText(del.segments)).toBe(base)
    // add side: the new sentence should be bright
    expect(changedText(add.segments)).toBe(' This sentence was added.')
    expect(unchangedText(add.segments)).toContain('quick brown fox')
  })

  it('del-run + blank same + add: pairs non-empty del with add across the blank same gap', () => {
    // Mirrors the exact LCS output seen in the console log:
    //   del ''  /  del 'long...sentence'  /  del ''  /  del ''  /  same ''  /  add 'long...'
    const base = 'intro\n\nThe last thirty-seven seconds blurred into infinity.  This is a new sentence\n\n'
    const cmp  = 'intro\n\nThe last thirty-seven seconds blurred into infinity.  \n\n'
    const out  = fullDiff(base, cmp)
    const del  = out.find(l => l.type === 'del' && l.text.includes('thirty-seven'))
    const add  = out.find(l => l.type === 'add' && l.text.includes('thirty-seven'))
    expect(del).toBeTruthy()
    expect(add).toBeTruthy()
    // del side: only the trailing sentence should be bright
    expect(changedText(del!.segments)).toBe('This is a new sentence')
    // add side: nothing really changed — should have a marker pin, no real changed text
    const hasMarker     = add!.segments?.some(s => s.changed && s.text === '' && s.marker)
    const hasRealChange = add!.segments?.some(s => s.changed && s.text !== '')
    expect(hasMarker).toBe(true)
    expect(hasRealChange).toBe(false)
  })

  it('sentence removed from end of long line: only removed text is bright on del side', () => {
    const base = 'The quick brown fox jumps over the lazy dog.  The quantum datastream overflowed his mind.  This is a new sentence'
    const cmp  = 'The quick brown fox jumps over the lazy dog.  The quantum datastream overflowed his mind.  '
    const out  = fullDiff(base, cmp)
    const del  = out.find(l => l.type === 'del')!
    const add  = out.find(l => l.type === 'add')!
    expect(del).toBeTruthy()
    expect(add).toBeTruthy()
    // del side: only the removed sentence should be bright
    expect(changedText(del.segments)).toBe('This is a new sentence')
    expect(unchangedText(del.segments)).toContain('The quick brown fox')
    // add side: no real changed chars — only a marker pin
    const hasMarker = add.segments?.some(s => s.changed && s.text === '' && s.marker)
    const hasRealChange = add.segments?.some(s => s.changed && s.text !== '')
    expect(hasMarker).toBe(true)
    expect(hasRealChange).toBe(false)
  })

  it('inline char change only marks the contiguous changed span', () => {
    // "dark" → "bright": prefix "It was a ", suffix " and stormy night."
    const out = fullDiff(
      'It was a dark and stormy night.',
      'It was a bright and stormy night.',
    )
    const del = out.find(l => l.type === 'del')!
    const add = out.find(l => l.type === 'add')!
    expect(changedText(del.segments)).toBe('dark')
    expect(changedText(add.segments)).toBe('bright')
    expect(unchangedText(del.segments)).toBe('It was a  and stormy night.')
  })
})

