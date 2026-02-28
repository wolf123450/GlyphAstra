/**
 * Image Pack Manager
 *
 * Stores resolved image data URLs in a per-story pack file so that images work
 * across machines and inside self-contained exports.  The pack file lives at
 * `stories/{storyId}/images.pack.json` in AppData.
 *
 * The markdown source is never modified — resolved data URLs are overlaid at
 * render time by checking the pack before falling back to live resolution.
 */

import { readFile as fsReadFile, writeFileContent } from '@/utils/storage/filesystem'
import { readFile as tauriFsReadFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PackedEntry {
  dataUrl:    string
  mime:       string
  byteSize:   number
  packedAt:   string
  sourceType: 'local' | 'remote' | 'absolute'
}

export interface PackFile {
  version:  number
  packedAt: string
  images:   Record<string, PackedEntry>
}

export interface PackResult {
  total:      number
  packed:     number
  skipped:    number
  failed:     number
  failedSrcs: string[]
  failedDetails: Array<{ src: string; error: string }>
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const packCache = new Map<string, PackFile>()

/** Maximum stories kept in the pack cache. */
const MAX_PACK_CACHE = 10

/** Set a pack in cache, evicting oldest if over limit. */
function cacheSet(storyId: string, pack: PackFile): void {
  if (!packCache.has(storyId) && packCache.size >= MAX_PACK_CACHE) {
    const oldest = packCache.keys().next().value
    if (oldest !== undefined) packCache.delete(oldest)
  }
  packCache.set(storyId, pack)
}

function packPath(storyId: string): string {
  return `stories/${storyId}/images.pack.json`
}

function emptyPack(): PackFile {
  return { version: 1, packedAt: new Date().toISOString(), images: {} }
}

function isAbsolutePath(src: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('/')
}

function isRemoteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src)
}

const MIME: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  svg:  'image/svg+xml',
  bmp:  'image/bmp',
  avif: 'image/avif',
}

/**
 * Detect MIME type from the first few bytes (magic numbers).
 * Falls back to the extension-based lookup, then to 'image/png'.
 */
function detectMime(bytes: Uint8Array, extMime: string): string {
  if (bytes.length >= 4) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png'
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg'
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
    if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp'
    // SVG — starts with '<' or UTF-8 BOM + '<'
    if (bytes[0] === 0x3C || (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF && bytes[3] === 0x3C)) return 'image/svg+xml'
  }
  return extMime
}

function bytesToDataUrl(arr: Uint8Array, mime: string): string {
  let b64 = ''
  const CHUNK = 8192
  for (let i = 0; i < arr.length; i += CHUNK) {
    b64 += String.fromCharCode(...arr.subarray(i, i + CHUNK))
  }
  return `data:${mime};base64,${btoa(b64)}`
}

/**
 * Attempt to resolve an image src to a PackedEntry.
 * Throws a descriptive error string on failure (never returns null).
 */
async function resolveImageToEntry(
  src: string,
  storyId: string,
): Promise<Omit<PackedEntry, 'packedAt'>> {
  if (isRemoteUrl(src)) {
    // Use the Tauri backend to fetch the URL — avoids WebView CORS restrictions
    try {
      const [b64, mime] = await invoke<[string, string]>('fetch_url_bytes', { url: src })
      const binaryStr = atob(b64)
      const arr = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) arr[i] = binaryStr.charCodeAt(i)
      const dataUrl = `data:${mime};base64,${b64}`
      return { dataUrl, mime, byteSize: arr.byteLength, sourceType: 'remote' }
    } catch (e) {
      throw new Error(`Remote fetch failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  let filePath: string
  let absolute: boolean
  let sourceType: 'local' | 'absolute'

  if (isAbsolutePath(src)) {
    // Pass the path as-is to Tauri — do NOT convert backslashes to forward slashes.
    // Tauri's capability scope matching on Windows uses the native separator (\\);
    // converting to forward slashes can break the scope check.
    filePath   = src
    absolute   = true
    sourceType = 'absolute'
  } else {
    const norm = src.startsWith('./') ? src.slice(2) : src
    filePath   = `stories/${storyId}/${norm}`
    absolute   = false
    sourceType = 'local'
  }

  let rawBytes: Uint8Array
  try {
    const result = absolute
      ? await tauriFsReadFile(filePath)
      : await tauriFsReadFile(filePath, { baseDir: BaseDirectory.AppData })
    rawBytes = new Uint8Array(result)
  } catch (e) {
    throw new Error(`File read failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  // MIME: try extension first, then magic-byte sniffing (handles files with no extension)
  const ext     = filePath.replace(/\\/g, '/').split('/').pop()?.split('.').pop()?.toLowerCase() ?? ''
  const extMime = MIME[ext] ?? 'image/png'
  const mime    = detectMime(rawBytes, extMime)

  return { dataUrl: bytesToDataUrl(rawBytes, mime), mime, byteSize: rawBytes.byteLength, sourceType }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load (and cache) the pack file for a story.
 * Returns an empty pack if the file does not exist.
 */
export async function loadPackFile(storyId: string): Promise<PackFile> {
  if (packCache.has(storyId)) return packCache.get(storyId)!

  const raw = await fsReadFile(packPath(storyId))
  if (!raw) {
    const empty = emptyPack()
    cacheSet(storyId, empty)
    return empty
  }
  try {
    const parsed = JSON.parse(raw) as PackFile
    cacheSet(storyId, parsed)
    return parsed
  } catch {
    const empty = emptyPack()
    cacheSet(storyId, empty)
    return empty
  }
}

/** Write the pack file to disk and update the in-memory cache. */
export async function savePackFile(storyId: string, pack: PackFile): Promise<void> {
  pack.packedAt = new Date().toISOString()
  cacheSet(storyId, pack)
  await writeFileContent(packPath(storyId), JSON.stringify(pack, null, 2))
}

/**
 * Return the packed data URL for a given src, or null if not yet packed.
 * Checks the in-memory cache first; loads from disk on first access.
 */
export async function getPackedDataUrl(storyId: string, src: string): Promise<string | null> {
  const pack = await loadPackFile(storyId)
  return pack.images[src]?.dataUrl ?? null
}

/**
 * Extract all unique image source strings from an array of markdown strings.
 * Handles both `![alt](src)` and `![alt](src "title")` syntax.
 */
export function extractImageSrcs(markdownContents: string[]): string[] {
  // Match ![...](src) or ![...](src "title") — capture only the href part
  // Note: single quotes are valid in file paths (e.g. "tiger's face.jpg"), so
  // only ) " and whitespace are used as terminators.
  const re = /!\[[^\]]*\]\(([^)"\s]+)/g
  const srcs = new Set<string>()
  for (const content of markdownContents) {
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(content)) !== null) {
      const src = m[1].trim().replace(/^["']|["']$/g, '')
      if (src) srcs.add(src)
    }
  }
  return [...srcs]
}

/**
 * Pack all images found in the given markdown strings into the story's pack file.
 *
 * - Already-packed entries are skipped unless `forceRepack` is true.
 * - Safe re-pack rule: a failure never overwrites an existing good entry.
 * - Returns a summary of what was packed, skipped, and failed.
 */
export async function packAllImages(
  storyId: string,
  markdownContents: string[],
  forceRepack = false,
): Promise<PackResult> {
  const srcs   = extractImageSrcs(markdownContents)
  const pack   = await loadPackFile(storyId)
  const result: PackResult = { total: srcs.length, packed: 0, skipped: 0, failed: 0, failedSrcs: [], failedDetails: [] }

  for (const src of srcs) {
    // Skip if already packed (and not forcing a re-pack)
    if (!forceRepack && pack.images[src]) {
      result.skipped++
      continue
    }

    try {
      const entry = await resolveImageToEntry(src, storyId)
      pack.images[src] = { ...entry, packedAt: new Date().toISOString() }
      result.packed++
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      // Safe re-pack rule: keep the existing good entry; only count as failed if no entry existed
      if (!pack.images[src]) {
        result.failed++
        result.failedSrcs.push(src)
        result.failedDetails.push({ src, error: errorMsg })
      } else {
        result.skipped++
      }
    }
  }

  await savePackFile(storyId, pack)
  return result
}

/** Remove a single image entry from the pack. */
export async function unpackImage(storyId: string, src: string): Promise<void> {
  const pack = await loadPackFile(storyId)
  if (pack.images[src]) {
    delete pack.images[src]
    await savePackFile(storyId, pack)
  }
}

/** Remove all packed image entries for a story (clears the pack file on disk). */
export async function clearPack(storyId: string): Promise<void> {
  await savePackFile(storyId, emptyPack())
}

/** Drop the in-memory pack cache for a story (call when switching stories). */
export function evictPackCache(storyId: string): void {
  packCache.delete(storyId)
}

/**
 * Return true if there are image srcs in the markdown that are absent from the pack.
 * Used for the "stale pack" indicator in the editor toolbar.
 */
export async function isPackStale(storyId: string, markdownContents: string[]): Promise<boolean> {
  const srcs = extractImageSrcs(markdownContents)
  if (srcs.length === 0) return false
  const pack = await loadPackFile(storyId)
  return srcs.some(src => !pack.images[src])
}

/**
 * Return the full list of image srcs found in the markdown that are NOT in the pack.
 * Used by the error icon segment to count and list unresolved images.
 */
export async function getUnpackedSrcs(storyId: string, markdownContents: string[]): Promise<string[]> {
  const srcs = extractImageSrcs(markdownContents)
  if (srcs.length === 0) return []
  const pack = await loadPackFile(storyId)
  return srcs.filter(src => !pack.images[src])
}
