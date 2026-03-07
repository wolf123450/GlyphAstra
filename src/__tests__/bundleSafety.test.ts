/**
 * Bundle safety tests — run AFTER `npm run build` (or `npm run test:bundle`).
 *
 * These tests catch CSP violations that would cause a blank window in
 * production: specifically, dependencies that call `new Function()` or
 * `eval()` at module-load time.  Such code is blocked by the Tauri CSP
 * `script-src 'self'` rule and silently kills the app before Vue mounts.
 *
 * History: epub-gen-memory (JSZip) and docx were statically imported and
 * both called `new Function()` during module evaluation — blank screen on
 * every release build until converted to dynamic imports.
 *
 * If no dist/ folder exists the whole suite is skipped, so normal
 * `npm test` runs are unaffected.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const DIST_DIR    = resolve(__dirname, '../../dist')
const ASSETS_DIR  = resolve(DIST_DIR, 'assets')
const INDEX_HTML  = resolve(DIST_DIR, 'index.html')

const hasBuild = existsSync(INDEX_HTML)

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Return the filename of the main JS chunk referenced in index.html. */
function getMainChunkName(): string {
  const html = readFileSync(INDEX_HTML, 'utf8')
  const m = html.match(/src="\/assets\/(index-[^"]+\.js)"/)
  if (!m) throw new Error('Could not locate main JS chunk in dist/index.html')
  return m[1]
}

/** Return all JS filenames that are eagerly loaded at startup:
 *  the main chunk + any <link rel="modulepreload"> chunks in index.html. */
function getEagerChunkNames(): string[] {
  const html = readFileSync(INDEX_HTML, 'utf8')
  const names: string[] = []

  // Main entry script
  const main = html.match(/src="\/assets\/(index-[^"]+\.js)"/)
  if (main) names.push(main[1])

  // Modulepreload hints (fetched + evaluated eagerly by the browser)
  for (const m of html.matchAll(/modulepreload[^>]+href="\/assets\/([^"]+\.js)"/g)) {
    names.push(m[1])
  }

  return [...new Set(names)]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe.skipIf(!hasBuild)('bundle safety (post-build)', () => {

  it('main chunk is present in dist/assets', () => {
    const name = getMainChunkName()
    expect(existsSync(resolve(ASSETS_DIR, name))).toBe(true)
  })

  it('eager bundles do not contain new Function() — CSP unsafe-eval', () => {
    // `new Function(` is the pattern used by JSZip and docx as a
    // global-detection shim.  Any occurrence in an eager chunk means the
    // CSP will block execution before Vue mounts → blank window.
    const chunks = getEagerChunkNames()
    expect(chunks.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const name of chunks) {
      const src = readFileSync(resolve(ASSETS_DIR, name), 'utf8')
      if (/new Function\(/.test(src)) {
        violations.push(name)
      }
    }

    expect(
      violations,
      `CSP violation: new Function() found in eager chunk(s): ${violations.join(', ')}\n` +
      `Convert the offending static import(s) to dynamic import() calls.`
    ).toEqual([])
  })

  it('epub-gen-memory / JSZip is not bundled into an eager chunk', () => {
    const chunks = getEagerChunkNames()
    for (const name of chunks) {
      const src = readFileSync(resolve(ASSETS_DIR, name), 'utf8')
      expect(src, `JSZip leaked into eager chunk ${name}`).not.toContain('JSZip')
    }
  })

  it('docx is not bundled into an eager chunk', () => {
    // docx exports a recognisable string we can key off without false positives
    const chunks = getEagerChunkNames()
    for (const name of chunks) {
      const src = readFileSync(resolve(ASSETS_DIR, name), 'utf8')
      // "docx" alone is too broad; key off the internal package marker
      expect(src, `docx leaked into eager chunk ${name}`).not.toContain('docx.js')
    }
  })

  it('all async (lazy) chunks exist on disk', () => {
    // Vite emits a manifest-like import map inside the main chunk.
    // Every chunk referenced there must be present so exports actually work.
    const mainName = getMainChunkName()
    const mainSrc  = readFileSync(resolve(ASSETS_DIR, mainName), 'utf8')

    // Extract filenames referenced as dynamic imports: "/assets/foo-hash.js"
    const referenced = [...mainSrc.matchAll(/"\/assets\/([-\w]+\.js)"/g)]
      .map(m => m[1])

    const missing = referenced.filter(n => !existsSync(resolve(ASSETS_DIR, n)))
    expect(
      missing,
      `Missing async chunk file(s): ${missing.join(', ')}`
    ).toEqual([])
  })

  it('lazy chunks exist for the known heavy exporters', () => {
    // Confirm the dynamic-import split actually happened: there should be
    // at least one async chunk that IS large enough to contain docx/JSZip
    const allChunks    = readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'))
    const eagerChunks  = new Set(getEagerChunkNames())
    const lazyChunks   = allChunks.filter(n => !eagerChunks.has(n))

    const hasJsZipChunk = lazyChunks.some(n => {
      const src = readFileSync(resolve(ASSETS_DIR, n), 'utf8')
      return src.includes('JSZip')
    })
    expect(hasJsZipChunk, 'Expected JSZip to appear in a lazy-loaded chunk').toBe(true)
  })
})
