/**
 * Local Storage Manager
 * Handles persistence of story data to browser localStorage
 */

import type { SerializedStory } from './storyManager'
import { validateStoryData } from './storyManager'
import { errorHandler, ErrorType } from './error'

const STORAGE_PREFIX = 'blockbreaker_story_'
const PROJECTS_LIST_KEY = 'blockbreaker_projects_list'

export interface StorageInfo {
  size: number
  keys: string[]
  available: boolean
}

class StorageManager {
  private isAvailable: boolean = false

  constructor() {
    this.checkAvailability()
  }

  /**
   * Check if localStorage is available
   */
  private checkAvailability() {
    try {
      const test = '__storage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      this.isAvailable = true
    } catch (error) {
      this.isAvailable = false
      errorHandler.logError(
        ErrorType.FILE_ERROR,
        'localStorage not available',
        error as Error
      )
    }
  }

  /**
   * Save story data
   */
  async saveStory(storyId: string, story: SerializedStory): Promise<boolean> {
    if (!this.isAvailable) {
      errorHandler.handleFileError('Storage not available')
      return false
    }

    try {
      const validation = validateStoryData(story)
      if (!validation.valid) {
        errorHandler.handleValidationError('Invalid story data', {
          errors: validation.errors,
        })
        return false
      }

      const key = `${STORAGE_PREFIX}${storyId}`
      const data = {
        id: storyId,
        ...story,
        lastSaved: new Date().toISOString(),
      }

      localStorage.setItem(key, JSON.stringify(data))

      // Update projects list
      this.addToProjectsList(storyId, story.metadata.title)

      console.log(`[Storage] Saved story: ${storyId}`)
      return true
    } catch (error) {
      errorHandler.handleFileError(
        `Failed to save story: ${storyId}`,
        error as Error
      )
      return false
    }
  }

  /**
   * Load story data
   */
  async loadStory(storyId: string): Promise<SerializedStory | null> {
    if (!this.isAvailable) {
      errorHandler.handleFileError('Storage not available')
      return null
    }

    try {
      const key = `${STORAGE_PREFIX}${storyId}`
      const data = localStorage.getItem(key)

      if (!data) {
        console.warn(`[Storage] Story not found: ${storyId}`)
        return null
      }

      const parsed = JSON.parse(data)
      const { id, lastSaved, ...story } = parsed

      const validation = validateStoryData(story)
      if (!validation.valid) {
        errorHandler.handleValidationError('Invalid stored story data', {
          storyId,
          errors: validation.errors,
        })
        return null
      }

      console.log(`[Storage] Loaded story: ${storyId}`)
      return story
    } catch (error) {
      errorHandler.handleFileError(
        `Failed to load story: ${storyId}`,
        error as Error
      )
      return null
    }
  }

  /**
   * Delete story
   */
  async deleteStory(storyId: string): Promise<boolean> {
    if (!this.isAvailable) {
      return false
    }

    try {
      const key = `${STORAGE_PREFIX}${storyId}`
      localStorage.removeItem(key)
      this.removeFromProjectsList(storyId)
      console.log(`[Storage] Deleted story: ${storyId}`)
      return true
    } catch (error) {
      errorHandler.handleFileError(`Failed to delete story: ${storyId}`, error as Error)
      return false
    }
  }

  /**
   * List all projects
   */
  getProjectsList(): Array<{ id: string; name: string; lastModified: string }> {
    try {
      const data = localStorage.getItem(PROJECTS_LIST_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  /**
   * Add project to list
   */
  private addToProjectsList(id: string, name: string) {
    try {
      const projects = this.getProjectsList()
      const existing = projects.findIndex((p) => p.id === id)

      const entry = {
        id,
        name,
        lastModified: new Date().toISOString(),
      }

      if (existing >= 0) {
        projects[existing] = entry
      } else {
        projects.push(entry)
      }

      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(projects))
    } catch (error) {
      console.error('[Storage] Failed to update projects list:', error)
    }
  }

  /**
   * Remove project from list
   */
  private removeFromProjectsList(id: string) {
    try {
      const projects = this.getProjectsList()
      const filtered = projects.filter((p) => p.id !== id)
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('[Storage] Failed to update projects list:', error)
    }
  }

  /**
   * Get storage info
   */
  getStorageInfo(): StorageInfo {
    const keys: string[] = []
    let size = 0

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(STORAGE_PREFIX)) {
          keys.push(key)
          const value = localStorage.getItem(key)
          if (value) {
            size += value.length
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return {
      size,
      keys,
      available: this.isAvailable,
    }
  }

  /**
   * Clear all story data
   */
  async clearAll(): Promise<boolean> {
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(STORAGE_PREFIX)) {
          keys.push(key)
        }
      }

      keys.forEach((key) => localStorage.removeItem(key))
      localStorage.removeItem(PROJECTS_LIST_KEY)

      console.log('[Storage] Cleared all data')
      return true
    } catch (error) {
      errorHandler.handleFileError('Failed to clear storage', error as Error)
      return false
    }
  }

  /**
   * Export all data as JSON
   */
  exportAll(): Record<string, any> {
    const data: Record<string, any> = {}

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(STORAGE_PREFIX)) {
          const value = localStorage.getItem(key)
          if (value) {
            data[key] = JSON.parse(value)
          }
        }
      }
    } catch (error) {
      console.error('[Storage] Failed to export data:', error)
    }

    return data
  }
}

export const storageManager = new StorageManager()
