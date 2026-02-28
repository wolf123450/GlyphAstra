/**
 * File System Utilities
 * Handles local file operations through Tauri plugin-fs.
 *
 * All paths are relative to BaseDirectory.AppData, which resolves to
 * %APPDATA%\blockbreaker on Windows.
 */

import {
  readTextFile,
  writeTextFile,
  writeFile,
  mkdir,
  readDir,
  exists,
  remove,
  rename,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { open, save } from "@tauri-apps/plugin-dialog";
import { logger } from '../logger';

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

const BASE = BaseDirectory.AppData;

/**
 * Ensure a directory (and all parents) exists.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { baseDir: BASE, recursive: true });
}

/**
 * Read a text file. Returns null if the file does not exist.
 */
export async function readFile(filePath: string): Promise<string | null> {
  try {
    if (!(await exists(filePath, { baseDir: BASE }))) return null;
    return await readTextFile(filePath, { baseDir: BASE });
  } catch (error) {
    logger.error('FS', 'Error reading file:', filePath, error);
    return null;
  }
}

/**
 * Atomically write (overwrite) a text file, creating parent dirs as needed.
 * Writes to a `.tmp` sibling first, then renames over the target so that a
 * crash mid-write never leaves a half-written file.
 */
export async function writeFileContent(
  filePath: string,
  content: string
): Promise<void> {
  const parts = filePath.split("/");
  if (parts.length > 1) {
    await ensureDir(parts.slice(0, -1).join("/"));
  }
  const tmpPath = filePath + '.tmp';
  await writeTextFile(tmpPath, content, { baseDir: BASE });
  await rename(tmpPath, filePath, {
    oldPathBaseDir: BASE,
    newPathBaseDir: BASE,
  });
}

/**
 * Check whether a path exists.
 */
export async function pathExists(filePath: string): Promise<boolean> {
  return exists(filePath, { baseDir: BASE });
}

/**
 * List the direct children of a directory.
 */
export async function listDirectory(dirPath: string): Promise<FileEntry[]> {
  try {
    if (!(await exists(dirPath, { baseDir: BASE }))) return [];
    const entries = await readDir(dirPath, { baseDir: BASE });
    return entries.map((e) => ({
      name: e.name ?? "",
      path: `${dirPath}/${e.name}`,
      isDir: e.isDirectory ?? false,
    }));
  } catch (error) {
    logger.error('FS', 'Error listing directory:', dirPath, error);
    return [];
  }
}

/**
 * Delete a file.
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    if (await exists(filePath, { baseDir: BASE })) {
      await remove(filePath, { baseDir: BASE });
    }
  } catch (error) {
    logger.error('FS', 'Error deleting file:', filePath, error);
  }
}

/**
 * Open file dialog for loading a markdown or text file.
 */
export async function openFileDialog(): Promise<string | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });
    return selected as string | null;
  } catch (error) {
    logger.error('FS', 'Error opening file dialog:', error);
    return null;
  }
}

/**
 * Save file dialog. Accepts optional custom filters (defaults to Markdown/Text).
 */
export async function saveFileDialog(
  filename: string,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<string | null> {
  try {
    const selected = await save({
      filters: filters ?? [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
      defaultPath: filename,
    });
    return selected as string | null;
  } catch (error) {
    logger.error('FS', 'Error saving file dialog:', error);
    return null;
  }
}

/**
 * Write a text file to an absolute path (e.g. one returned by saveFileDialog).
 * Requires fs:allow-home-write-recursive capability.
 */
export async function writeAbsoluteFile(
  absolutePath: string,
  content: string
): Promise<void> {
  await writeTextFile(absolutePath, content);
}

/**
 * Read a text file from an absolute path.
 * Requires fs:allow-home-read-recursive capability.
 */
export async function readAbsoluteFile(
  absolutePath: string
): Promise<string | null> {
  try {
    return await readTextFile(absolutePath);
  } catch {
    return null;
  }
}

/**
 * Write binary data to an absolute path (used for DOCX export).
 * Requires fs:allow-home-write-recursive capability.
 */
export async function writeBinaryAbsolute(
  absolutePath: string,
  data: Uint8Array
): Promise<void> {
  await writeFile(absolutePath, data);
}
