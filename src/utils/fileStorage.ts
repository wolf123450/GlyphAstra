/**
 * File-Based Storage Layer
 *
 * Persists story data to the local file system (via Tauri plugin-fs) in
 * addition to localStorage.  Stories are organized under AppData as:
 *
 *   stories/{storyId}/story.json          ← metadata, characters, chapter list
 *   stories/{storyId}/chapters/{id}.md    ← each chapter's content
 */

import type { SerializedStory } from "./storyManager";
import {
  readFile,
  writeFileContent,
  pathExists,
  listDirectory,
} from "./filesystem";
import { remove, BaseDirectory } from "@tauri-apps/plugin-fs";

const STORIES_ROOT = "stories";

function storyDir(storyId: string) {
  return `${STORIES_ROOT}/${storyId}`;
}
function storyMetaPath(storyId: string) {
  return `${storyDir(storyId)}/story.json`;
}
function chapterPath(storyId: string, chapterId: string) {
  return `${storyDir(storyId)}/chapters/${chapterId}.md`;
}

/**
 * Persist a complete story (metadata + characters + all chapters) to disk.
 */
export async function saveStory(
  storyId: string,
  story: SerializedStory
): Promise<boolean> {
  try {
    // Save story metadata + character list (no chapter content here)
    const meta = {
      metadata: story.metadata,
      characters: story.characters,
      // Store all chapter fields except content (content is saved per-chapter as .md files)
      chapters: story.chapters.map(({ content: _content, ...rest }) => rest),
      lastSaved: new Date().toISOString(),
    };
    await writeFileContent(storyMetaPath(storyId), JSON.stringify(meta, null, 2));

    // Save each chapter's content as a separate .md file
    for (const ch of story.chapters) {
      await writeFileContent(chapterPath(storyId, ch.id), ch.content ?? "");
    }

    console.log(`[FileStorage] Saved story: ${storyId}`);
    return true;
  } catch (error) {
    console.error("[FileStorage] Error saving story:", storyId, error);
    return false;
  }
}

/**
 * Load a complete story from disk.  Returns null if not found.
 */
export async function loadStory(
  storyId: string
): Promise<SerializedStory | null> {
  try {
    const metaJson = await readFile(storyMetaPath(storyId));
    if (!metaJson) return null;

    const meta = JSON.parse(metaJson);

    // Load each chapter's content
    const chapters = await Promise.all(
      (meta.chapters as SerializedStory["chapters"]).map(async (ch) => {
        const content = await readFile(chapterPath(storyId, ch.id));
        return {
          ...ch,
          content: content ?? "",
        };
      })
    );

    console.log(`[FileStorage] Loaded story: ${storyId}`);
    return {
      metadata: meta.metadata,
      characters: meta.characters ?? [],
      chapters,
    };
  } catch (error) {
    console.error("[FileStorage] Error loading story:", storyId, error);
    return null;
  }
}

/**
 * List all story projects found on disk.
 */
export async function listProjects(): Promise<
  Array<{ id: string; name: string; lastModified: string }>
> {
  try {
    if (!(await pathExists(STORIES_ROOT))) return [];

    const entries = await listDirectory(STORIES_ROOT);
    const results: Array<{ id: string; name: string; lastModified: string }> = [];

    for (const entry of entries) {
      if (!entry.isDir) continue;
      const storyId = entry.name;
      const metaJson = await readFile(storyMetaPath(storyId));
      if (!metaJson) continue;

      try {
        const meta = JSON.parse(metaJson);
        results.push({
          id: storyId,
          name: meta.metadata?.title ?? storyId,
          lastModified:
            meta.lastSaved ?? meta.metadata?.lastModified ?? new Date().toISOString(),
        });
      } catch {
        // Skip corrupted entries
      }
    }

    return results;
  } catch (error) {
    console.error("[FileStorage] Error listing projects:", error);
    return [];
  }
}

/**
 * Delete a story's directory and all its files from disk.
 */
export async function deleteStory(storyId: string): Promise<boolean> {
  try {
    const dir = storyDir(storyId);
    if (await pathExists(dir)) {
      await remove(dir, { baseDir: BaseDirectory.AppData, recursive: true });
    }
    console.log(`[FileStorage] Deleted story: ${storyId}`);
    return true;
  } catch (error) {
    console.error("[FileStorage] Error deleting story:", storyId, error);
    return false;
  }
}
