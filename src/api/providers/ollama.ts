/**
 * Ollama provider — wraps the existing OllamaClient to implement ModelProvider.
 */

import { OllamaClient } from '@/api/ollama'
import type { ModelProvider, ModelInfo, CompletionOptions } from './types'

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama'
  readonly name = 'Ollama (Local)'

  private client: OllamaClient

  constructor(baseUrl?: string) {
    this.client = new OllamaClient(baseUrl)
  }

  async isAvailable(): Promise<boolean> {
    return this.client.checkConnection()
  }

  async listModels(): Promise<ModelInfo[]> {
    const names = await this.client.listModels()
    return names.map((n) => ({ id: n, name: n, providerId: this.id }))
  }

  async streamCompletion(
    prompt: string,
    opts: CompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    await this.client.generateStream(
      {
        model:       opts.model,
        prompt,
        stream:      true,
        temperature: opts.temperature,
        num_predict: opts.maxTokens,
        stop:        opts.stop,
      },
      onChunk
    )
  }
}
