// ─── diff engine ─────────────────────────────────────────────────────────────
// Shared by ChapterHistory.vue and its unit tests.

export type InlineSegment = { changed: boolean; text: string; marker?: boolean }
export type DiffLine = { type: 'same' | 'add' | 'del'; text: string; segments?: InlineSegment[] }

// ─── Line-level LCS diff ──────────────────────────────────────────────────────

export function computeLineDiff(base: string, comparison: string): DiffLine[] {
  const a = base.split('\n')
  const b = comparison.split('\n')
  const m = a.length
  const n = b.length

  // Guard against very large texts for perf
  if (m * n > 120_000) {
    return [
      { type: 'del', text: '— base (too large for inline diff) —' },
      { type: 'add', text: '— comparison (too large for inline diff) —' },
    ]
  }

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrace
  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'same', text: a[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', text: b[j - 1] })   // added in comparison
      j--
    } else {
      result.unshift({ type: 'del', text: a[i - 1] })   // removed from base
      i--
    }
  }
  return result
}

// ─── Char-level LCS helpers ───────────────────────────────────────────────────

/** Find the common prefix and suffix lengths between two strings. */
function splitPoints(text: string, other: string): { prefix: number; suffix: number } {
  if (!text || !other) return { prefix: 0, suffix: 0 }
  const maxLen = Math.min(text.length, other.length)
  let prefix = 0
  while (prefix < maxLen && text[prefix] === other[prefix]) prefix++
  let suffix = 0
  const maxSuffix = Math.min(text.length - prefix, other.length - prefix)
  while (
    suffix < maxSuffix &&
    text[text.length - 1 - suffix] === other[other.length - 1 - suffix]
  ) suffix++
  return { prefix, suffix }
}

/**
 * Produce inline segments for `text` by stripping the longest common
 * prefix and suffix with `other`.  Everything in between is one contiguous
 * changed span.  This mirrors VS Code's inline diff behaviour and avoids the
 * "scattered unchanged chars" problem that full char-LCS produces.
 */
export function charSegments(text: string, other: string): InlineSegment[] {
  if (!text) return [{ changed: false, text: '' }]
  if (!other) return [{ changed: true, text }]

  const { prefix, suffix } = splitPoints(text, other)
  const middle = text.slice(prefix, text.length - suffix || undefined)

  const segs: InlineSegment[] = []
  if (prefix > 0)  segs.push({ changed: false, text: text.slice(0, prefix) })
  if (middle)      segs.push({ changed: true,  text: middle })
  if (suffix > 0)  segs.push({ changed: false, text: text.slice(text.length - suffix) })
  if (segs.length === 0) segs.push({ changed: false, text: '' })
  return segs
}

/** Attach fully-changed segments to an unpaired del or add line. */
function unpairedLine(line: DiffLine): DiffLine {
  return {
    ...line,
    segments: line.text ? [{ changed: true, text: line.text }] : [{ changed: false, text: '' }],
  }
}

/** Attach char-level segments to a matched del+add pair. */
function applyCharDiff(delLine: DiffLine, addLine: DiffLine): [DiffLine, DiffLine] {
  const delSegs = charSegments(delLine.text, addLine.text)
  const addSegs = charSegments(addLine.text, delLine.text)
  const outDel: DiffLine = { ...delLine, segments: delSegs }
  let outAdd: DiffLine
  if (addSegs.some(s => s.changed)) {
    outAdd = { ...addLine, segments: addSegs }
  } else {
    // Pure deletion within a line: show a zero-width marker pin at the deletion point.
    const { prefix } = splitPoints(addLine.text, delLine.text)
    const markerSegs: InlineSegment[] = []
    if (prefix > 0) markerSegs.push({ changed: false, text: addLine.text.slice(0, prefix) })
    markerSegs.push({ changed: true, text: '', marker: true })
    if (prefix < addLine.text.length) markerSegs.push({ changed: false, text: addLine.text.slice(prefix) })
    outAdd = { ...addLine, segments: markerSegs }
  }
  return [outDel, outAdd]
}

/**
 * Pair del-runs with add-runs and attach char-level segments to each line.
 *
 * Blank `same` lines between a del-run and add-run are treated as transparent
 * separators so that e.g. removing a sentence from the end of a paragraph
 * (which the LCS may split across del+same+add) still gets a clean pairing.
 *
 * Within a del-run/add-run, each add is paired with the del that shares the
 * longest common prefix (best similarity).  Unpaired lines are fully highlighted.
 */
export function pairDelAdd(lines: DiffLine[]): DiffLine[] {
  const out: DiffLine[] = []
  let i = 0

  while (i < lines.length) {
    if (lines[i].type !== 'del') {
      out.push(lines[i].type === 'add' ? unpairedLine(lines[i]) : lines[i])
      i++
      continue
    }

    // ── collect consecutive del lines ──────────────────────────────────────
    const delStart = i
    while (i < lines.length && lines[i].type === 'del') i++
    const delLines = lines.slice(delStart, i)
    const skipStart = i

    // ── skip blank same-lines (transparent separators) ─────────────────────
    while (i < lines.length && lines[i].type === 'same' && lines[i].text === '') i++
    const blankSames = lines.slice(skipStart, i)

    // ── check for a following add-run ──────────────────────────────────────
    if (i < lines.length && lines[i].type === 'add') {
      const addStart = i
      while (i < lines.length && lines[i].type === 'add') i++
      const addLines = lines.slice(addStart, i)

      // Greedy best-match: for each add, find the most similar unused del.
      // Score = common prefix length; prefer non-empty del for non-empty add.
      const usedDel = new Set<number>()
      const paired = new Map<number, { delIdx: number; outDel: DiffLine; outAdd: DiffLine }>()

      for (let aIdx = 0; aIdx < addLines.length; aIdx++) {
        const add = addLines[aIdx]
        let bestDIdx = -1
        let bestScore = -1
        for (let dIdx = 0; dIdx < delLines.length; dIdx++) {
          if (usedDel.has(dIdx)) continue
          const del = delLines[dIdx]
          let score: number
          if (!del.text && !add.text) {
            score = 0            // both blank — match but low priority
          } else if (del.text && add.text) {
            score = splitPoints(del.text, add.text).prefix
          } else {
            score = -1           // mismatched empty/non-empty — skip
          }
          if (score > bestScore) { bestScore = score; bestDIdx = dIdx }
        }
        if (bestDIdx !== -1) {
          usedDel.add(bestDIdx)
          const [outDel, outAdd] = applyCharDiff(delLines[bestDIdx], add)
          paired.set(aIdx, { delIdx: bestDIdx, outDel, outAdd })
        }
      }

      // Emit del lines in original order (paired → with segments, unpaired → fully bright)
      for (let dIdx = 0; dIdx < delLines.length; dIdx++) {
        const p = [...paired.values()].find(v => v.delIdx === dIdx)
        out.push(p ? p.outDel : unpairedLine(delLines[dIdx]))
      }
      // Re-insert blank same lines
      for (const s of blankSames) out.push(s)
      // Emit add lines in original order
      for (let aIdx = 0; aIdx < addLines.length; aIdx++) {
        const p = paired.get(aIdx)
        out.push(p ? p.outAdd : unpairedLine(addLines[aIdx]))
      }
    } else {
      // No following add-run: emit all dels as unpaired, restore blank sames
      for (const d of delLines) out.push(unpairedLine(d))
      for (const s of blankSames) out.push(s)
    }
  }
  return out
}

/** Full pipeline: line diff → char pairing → final DiffLine[]. */
export function fullDiff(base: string, comparison: string): DiffLine[] {
  return pairDelAdd(computeLineDiff(base, comparison))
}
