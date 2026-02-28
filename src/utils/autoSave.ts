/**
 * Auto-Save System
 * Handles debounced saving of story content
 */

import { logger } from './logger'

export interface AutoSaveConfig {
  interval: number // milliseconds
}

const DEFAULT_CONFIG: AutoSaveConfig = {
  interval: 10000, // 10 seconds
}

class AutoSaveManager {
  private config: AutoSaveConfig
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private lastSaveTime: Map<string, number> = new Map()
  private saveCallbacks: Map<string, () => Promise<void>> = new Map()

  constructor(config: Partial<AutoSaveConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Register a save callback for an entity
   */
  registerSaveCallback(entityId: string, callback: () => Promise<void>) {
    this.saveCallbacks.set(entityId, callback)
  }

  /**
   * Unregister a save callback
   */
  unregisterSaveCallback(entityId: string) {
    this.saveCallbacks.delete(entityId)
    this.cancelAutoSave(entityId)
  }

  /**
   * Trigger auto-save with debouncing
   */
  triggerAutoSave(entityId: string) {
    // Cancel existing timer
    if (this.timers.has(entityId)) {
      clearTimeout(this.timers.get(entityId))
    }

    // Set new timer
    const timeoutId = setTimeout(async () => {
      await this.executeSave(entityId)
    }, this.config.interval)

    this.timers.set(entityId, timeoutId)
  }

  /**
   * Execute save immediately
   */
  async executeSave(entityId: string) {
    const callback = this.saveCallbacks.get(entityId)
    if (!callback) return

    try {
      await callback()
      this.lastSaveTime.set(entityId, Date.now())
      logger.info('AutoSave', `Saved ${entityId}`)
    } catch (error) {
      logger.error('AutoSave', `Failed to save ${entityId}:`, error)
    }
  }

  /**
   * Cancel pending auto-save
   */
  cancelAutoSave(entityId: string) {
    const timerId = this.timers.get(entityId)
    if (timerId) {
      clearTimeout(timerId)
      this.timers.delete(entityId)
    }
  }

  /**
   * Force save all pending changes
   */
  async saveAll() {
    const promises = Array.from(this.saveCallbacks.keys()).map((entityId) =>
      this.executeSave(entityId)
    )
    await Promise.all(promises)
  }

  /**
   * Get last save time
   */
  getLastSaveTime(entityId: string): number | null {
    return this.lastSaveTime.get(entityId) || null
  }

  /**
   * Get time since last save in seconds
   */
  getTimeSinceLastSave(entityId: string): number {
    const lastSave = this.lastSaveTime.get(entityId)
    if (!lastSave) return Infinity
    return Math.floor((Date.now() - lastSave) / 1000)
  }

  /**
   * Check if entity has unsaved changes
   */
  hasUnsavedChanges(entityId: string): boolean {
    return this.timers.has(entityId)
  }

  /**
   * Get all pending saves
   */
  getPendingSaves(): string[] {
    return Array.from(this.timers.keys())
  }

  /**
   * Clear all timers
   */
  clear() {
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.clear()
    this.lastSaveTime.clear()
    this.saveCallbacks.clear()
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<AutoSaveConfig>) {
    this.config = { ...this.config, ...config }
  }
}

export const autoSaveManager = new AutoSaveManager()
