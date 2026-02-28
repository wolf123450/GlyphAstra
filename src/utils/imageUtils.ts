/**
 * Image Utilities
 *
 * Resolves local image references (relative paths in markdown) to base64 data
 * URLs so Tauri's WebView can display them.  Results are cached in memory for
 * the lifetime of the page; call clearImageCache() when a story is unloaded.
 */

import { readFile as tauriFsReadFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { getPackedDataUrl } from './imagePackManager'

/** In-memory cache: appData-relative path → data URL */
const dataUrlCache = new Map<string, string>()

/** Extension → MIME type */
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
 * Whether a src string is an absolute filesystem path.
 * Windows: starts with a drive letter (C:\, D:/, ...)
 * Unix:    starts with /
 */
function isAbsolutePath(src: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('/')
}

/**
 * Read a file and return a base64 data URL.
 * Returns null on any error (file missing, unreadable, etc.).
 */
async function resolveToDataUrl(rawSrc: string, storyId: string | null): Promise<string | null> {
  // Strip any surrounding single or double quotes the author may have written
  const src = rawSrc.replace(/^["']|["']$/g, '').trim()
  if (!src) return null

  // 1. Check the image pack store (highest priority — works offline & in exports)
  if (storyId) {
    const packed = await getPackedDataUrl(storyId, src)
    if (packed) return packed
  }

  // Build the key and the path to actually read
  let cacheKey: string
  let filePath: string
  let absolute: boolean

  if (isAbsolutePath(src)) {
    // Normalise backslashes → forward slashes for Tauri
    filePath  = src.replace(/\\/g, '/')
    cacheKey  = filePath
    absolute  = true
  } else {
    const normalized = src.startsWith('./') ? src.slice(2) : src
    filePath  = storyId ? `stories/${storyId}/${normalized}` : normalized
    cacheKey  = filePath
    absolute  = false
  }

  if (dataUrlCache.has(cacheKey)) return dataUrlCache.get(cacheKey)!

  try {
    // Absolute paths must NOT use baseDir (Tauri would prepend AppData)
    const bytes = absolute
      ? await tauriFsReadFile(filePath)
      : await tauriFsReadFile(filePath, { baseDir: BaseDirectory.AppData })

    const ext   = filePath.split('.').pop()?.toLowerCase() ?? 'png'
    const mime  = MIME[ext] ?? 'image/png'

    let b64 = ''
    const arr   = new Uint8Array(bytes)
    const CHUNK = 8192
    for (let i = 0; i < arr.length; i += CHUNK) {
      b64 += String.fromCharCode(...arr.subarray(i, i + CHUNK))
    }
    const dataUrl = `data:${mime};base64,${btoa(b64)}`
    dataUrlCache.set(cacheKey, dataUrl)
    return dataUrl
  } catch {
    return null
  }
}

/**
 * Scan `container` for any `<img data-local-src="...">` elements and replace
 * their `src` with a resolved data URL.  Already-resolved images (the
 * `data-resolved` attribute matches `data-local-src`) are skipped.
 */
export async function resolveLocalImages(
  container: HTMLElement,
  storyId: string | null,
): Promise<void> {
  const imgs = container.querySelectorAll<HTMLImageElement>('img[data-local-src]')
  if (!imgs.length) return

  await Promise.all(
    Array.from(imgs).map(async (img) => {
      const rawSrc = img.getAttribute('data-local-src') ?? ''
      if (!rawSrc || img.getAttribute('data-resolved') === rawSrc) return

      const dataUrl = await resolveToDataUrl(rawSrc, storyId)
      if (dataUrl) {
        img.src = dataUrl
        img.classList.remove('md-image-broken')
      } else {
        img.classList.add('md-image-broken')
      }
      // Mark as processed regardless so we don't keep retrying on every render
      img.setAttribute('data-resolved', rawSrc)
    }),
  )
}

/** Wipe the data URL cache — call when switching stories. */
export function clearImageCache(): void {
  dataUrlCache.clear()
}
