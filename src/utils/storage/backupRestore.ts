/**
 * Backup & Restore
 *
 * Exports the full story state (metadata, chapters with ALL fields, characters)
 * to a single JSON file.  Restoring from a backup creates a fresh story with a
 * new ID so it never overwrites an existing project.
 *
 * File format:
 *   {
 *     "version": 1,
 *     "exportedAt": "<ISO date>",
 *     "originalStoryId": "story-...",
 *     "metadata": { ...StoryMetadata },
 *     "chapters":  [ ...Chapter[]  ],   // full Chapter objects — AI metadata included
 *     "characters": [ ...Character[] ]
 *   }
 */

import { save, open } from '@tauri-apps/plugin-dialog'
import { writeAbsoluteFile, readAbsoluteFile } from './filesystem'
import type { Chapter, Character, StoryMetadata } from '@/stores/storyStore'

// ─── Public types ────────────────────────────────────────────────────────────

export interface BackupFile {
  version: 1
  exportedAt: string
  originalStoryId: string
  metadata: StoryMetadata
  chapters: Chapter[]
  characters: Character[]
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Prompts the user to choose a save location and writes a `.json` backup.
 * Returns `true` on success, `false` if the user cancelled.
 */
export async function exportBackup(
  storyId: string,
  metadata: StoryMetadata,
  chapters: Chapter[],
  characters: Character[],
): Promise<boolean> {
  const safeTitle = (metadata.title || 'story')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  const date = new Date().toISOString().slice(0, 10)
  const defaultPath = `${safeTitle}-backup-${date}.json`

  const savePath = await save({
    filters: [{ name: 'Glyph Astra Backup', extensions: ['json'] }],
    defaultPath,
  })
  if (!savePath) return false

  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    originalStoryId: storyId,
    metadata,
    chapters,
    characters,
  }

  await writeAbsoluteFile(savePath as string, JSON.stringify(backup, null, 2))
  return true
}

// ─── Import ──────────────────────────────────────────────────────────────────

/**
 * Prompts the user to open a backup `.json` file.
 * Returns the parsed `BackupFile` on success, `null` if cancelled, or throws
 * if the file is malformed.
 */
export async function importBackup(): Promise<BackupFile | null> {
  const filePath = await open({
    multiple: false,
    filters: [{ name: 'Glyph Astra Backup', extensions: ['json'] }],
  })
  if (!filePath) return null

  const raw = await readAbsoluteFile(filePath as string)
  if (!raw) throw new Error('Could not read backup file.')

  // Guard against absurdly large backup files (100 MB limit)
  const MAX_BACKUP_BYTES = 100 * 1024 * 1024
  if (raw.length > MAX_BACKUP_BYTES) {
    throw new Error(`Backup file too large (${(raw.length / 1024 / 1024).toFixed(1)} MB). Maximum is 100 MB.`)
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('Backup file is not valid JSON.')
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    (data as BackupFile).version !== 1 ||
    typeof (data as BackupFile).metadata !== 'object' ||
    !Array.isArray((data as BackupFile).chapters)
  ) {
    throw new Error('Invalid or incompatible backup file.')
  }

  return data as BackupFile
}
