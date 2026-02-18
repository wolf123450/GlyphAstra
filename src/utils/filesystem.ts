/**
 * File System Utilities
 * Handles local file operations through Tauri
 */

import { open, save } from "@tauri-apps/plugin-dialog";

// Note: File system operations will be added with Tauri plugin-fs
// For now, we'll provide the interface for future implementation

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface StoryProject {
  name: string;
  path: string;
  createdDate: string;
  lastModified: string;
}

/**
 * Read file contents
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    // This will be implemented with Tauri file system plugin
    console.log("Loading file:", filePath);
    return "";
  } catch (error) {
    console.error("Error reading file:", error);
    throw error;
  }
}

/**
 * Write file contents
 */
export async function writeFileContent(
  filePath: string,
  _content: string
): Promise<void> {
  try {
    // This will be implemented with Tauri file system plugin
    console.log("Writing to file:", filePath);
  } catch (error) {
    console.error("Error writing file:", error);
    throw error;
  }
}

/**
 * Create a directory
 */
export async function createDirectory(dirPath: string): Promise<void> {
  try {
    // This will be implemented with Tauri file system plugin
    console.log("Creating directory:", dirPath);
  } catch (error) {
    console.error("Error creating directory:", error);
    throw error;
  }
}

/**
 * List directory contents
 */
export async function listDirectory(dirPath: string): Promise<FileEntry[]> {
  try {
    // This will be implemented with Tauri file system plugin
    console.log("Listing directory:", dirPath);
    return [];
  } catch (error) {
    console.error("Error listing directory:", error);
    throw error;
  }
}

/**
 * Open file dialog for loading
 */
export async function openFileDialog(): Promise<string | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Markdown",
          extensions: ["md"],
        },
        {
          name: "Text",
          extensions: ["txt"],
        },
      ],
    });
    return selected as string | null;
  } catch (error) {
    console.error("Error opening file dialog:", error);
    return null;
  }
}

/**
 * Save file dialog
 */
export async function saveFileDialog(
  filename: string
): Promise<string | null> {
  try {
    const selected = await save({
      filters: [
        {
          name: "Markdown",
          extensions: ["md"],
        },
        {
          name: "Text",
          extensions: ["txt"],
        },
      ],
      defaultPath: filename,
    });
    return selected as string | null;
  } catch (error) {
    console.error("Error saving file dialog:", error);
    return null;
  }
}

/**
 * Initialize a story project structure
 */
export async function initializeStoryProject(
  projectPath: string,
  storyName: string
): Promise<void> {
  try {
    // Create project directory
    await createDirectory(projectPath);

    // Create chapters directory
    await createDirectory(`${projectPath}/chapters`);

    // Create story.json metadata file
    const metadata = {
      title: storyName,
      summary: "",
      genre: "",
      tone: "",
      narrativeVoice: "",
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      wordCount: 0,
      characters: [],
    };

    await writeFileContent(
      `${projectPath}/story.json`,
      JSON.stringify(metadata, null, 2)
    );
  } catch (error) {
    console.error("Error initializing story project:", error);
    throw error;
  }
}

/**
 * Load story metadata
 */
export async function loadStoryMetadata(
  projectPath: string
): Promise<Record<string, any>> {
  try {
    const content = await readFile(`${projectPath}/story.json`);
    return JSON.parse(content);
  } catch (error) {
    console.error("Error loading story metadata:", error);
    throw error;
  }
}

/**
 * Save story metadata
 */
export async function saveStoryMetadata(
  projectPath: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await writeFileContent(
      `${projectPath}/story.json`,
      JSON.stringify(metadata, null, 2)
    );
  } catch (error) {
    console.error("Error saving story metadata:", error);
    throw error;
  }
}
