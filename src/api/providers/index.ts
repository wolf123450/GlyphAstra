/**
 * Provider registry — central factory for all ModelProvider instances.
 *
 * Usage in composables / components:
 *   import { makeProvider, PROVIDER_META, ALL_PROVIDER_IDS } from '@/api/providers'
 *
 *   const provider = makeProvider(aiStore.activeProviderId, aiStore.providerApiKeys)
 *   await provider.streamCompletion(...)
 */

export { OllamaProvider  } from './ollama'
export { OpenAIProvider  } from './openai'
export { AnthropicProvider } from './anthropic'
export { GoogleProvider  } from './google'
export type { ModelProvider, ModelInfo, CompletionOptions } from './types'

import { OllamaProvider   } from './ollama'
import { OpenAIProvider   } from './openai'
import { AnthropicProvider } from './anthropic'
import { GoogleProvider   } from './google'
import type { ModelProvider } from './types'

export type ProviderId = 'ollama' | 'openai' | 'anthropic' | 'google'

export const ALL_PROVIDER_IDS: ProviderId[] = ['ollama', 'openai', 'anthropic', 'google']

/** Static display metadata — safe to use outside of setup(). */
export const PROVIDER_META: Record<ProviderId, { name: string; hint: string; docsUrl: string }> = {
  ollama: {
    name:    'Ollama (Local)',
    hint:    'Runs models locally on your machine. No API key needed.',
    docsUrl: 'https://ollama.com',
  },
  openai: {
    name:    'OpenAI',
    hint:    'GPT-4o, GPT-4 Turbo, and more. Requires an OpenAI API key.',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name:    'Anthropic',
    hint:    'Claude Opus, Sonnet, and Haiku models. Requires an Anthropic API key.',
    docsUrl: 'https://console.anthropic.com/keys',
  },
  google: {
    name:    'Google Gemini',
    hint:    'Gemini 2.0 Flash, 1.5 Pro, and more. Requires a Google AI Studio API key.',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
}

/**
 * Construct a provider instance for the given ID, injecting the
 * appropriate API key from the keys map.
 *
 * For Ollama, `keys` is ignored (no key needed).
 */
export function makeProvider(
  providerId: ProviderId,
  keys: Record<string, string>,
  ollamaBaseUrl?: string
): ModelProvider {
  switch (providerId) {
    case 'ollama':
      return new OllamaProvider(ollamaBaseUrl)
    case 'openai':
      return new OpenAIProvider(keys['openai'] ?? '')
    case 'anthropic':
      return new AnthropicProvider(keys['anthropic'] ?? '')
    case 'google':
      return new GoogleProvider(keys['google'] ?? '')
    default: {
      // Exhaustive guard — TypeScript should catch unknown IDs at compile time
      const _: never = providerId
      throw new Error(`Unknown provider ID: ${_}`)
    }
  }
}
