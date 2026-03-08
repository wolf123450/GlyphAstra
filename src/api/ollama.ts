/**
 * Ollama API Client
 * Handles communication with local Ollama instance
 */

export interface GenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  stop?: string[];
}

export interface GenerateResponse {
  model: string;
  response: string;
  done: boolean;
  created_at?: string;
  eval_count?: number;
  eval_duration?: number;
}

export interface ListTagsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
    digest: string;
  }>;
}

const OLLAMA_BASE_URL = "http://localhost:11434";

import { logger } from '@/utils/logger';

/** True when running inside Tauri — use invoke() for non-streaming calls. */
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if Ollama is running and accessible
   */
  async checkConnection(): Promise<boolean> {
    try {
      if (isTauri) return await tauriInvoke<boolean>('check_ollama_connection')
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      logger.error('Ollama', 'Connection error:', error);
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async listModels(): Promise<string[]> {
    try {
      if (isTauri) return await tauriInvoke<string[]>('list_ollama_models')
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data: ListTagsResponse = await response.json();
      return data.models.map((m) => m.name);
    } catch (error) {
      logger.error('Ollama', 'Error fetching models:', error);
      return [];
    }
  }

  /**
   * Generate text completion
   */
  async generate(request: GenerateRequest): Promise<string> {
    try {
      // Ollama expects model parameters inside an `options` wrapper —
      // mirror the structure used in generateStream().
      const body: Record<string, unknown> = {
        model:  request.model,
        prompt: request.prompt,
        stream: request.stream,
        options: {
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(request.num_predict !== undefined && { num_predict: request.num_predict }),
          ...(request.top_p       !== undefined && { top_p:       request.top_p }),
          ...(request.top_k       !== undefined && { top_k:       request.top_k }),
          ...(request.stop        !== undefined && { stop:        request.stop }),
        },
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let fullResponse = "";

      if (request.stream) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (line.trim()) {
                  const json: GenerateResponse = JSON.parse(line);
                  fullResponse += json.response;
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
      } else {
        const data: GenerateResponse = await response.json();
        fullResponse = data.response;
      }

      return fullResponse;
    } catch (error) {
      logger.error('Ollama', 'Error generating text:', error);
      throw error;
    }
  }

  /**
   * Generate with streaming support
   */
  async generateStream(
    request: GenerateRequest,
    onChunk: (chunk: string) => void,
    onThinkingChange?: (isThinking: boolean) => void
  ): Promise<void> {
    try {
      // GPT-OSS requires think:"low"|"medium"|"high" — it ignores true/false.
      // qwen3.5 supports think:false to cleanly disable thinking mode.
      // qwen3/qwq/deepseek-r1 natively separate thinking into a `thinking` JSON
      // field — passing think:false to them redirects thinking into `response`
      // (breaking our handling), so we leave `think` unset and rely on the token
      // overhead to ensure they finish thinking before the response ends.
      const modelLower = request.model.toLowerCase()
      const isGptOss      = modelLower.startsWith('gpt-oss')
      const isQwen35      = /^qwen3\.5/.test(modelLower)
      const isNativeThink = /^(qwen3(?!\.5)|qwq|deepseek-r1)/.test(modelLower)
      const thinkValue: string | boolean | undefined =
        isGptOss ? 'low' : isQwen35 ? false : undefined

      // gpt-oss and native-thinking models (qwen3/qwq/deepseek-r1) consume
      // thinking tokens from num_predict, so pad the budget so the model can
      // complete its reasoning and still produce a full response.
      const THINKING_OVERHEAD = 2048
      const adjustedNumPredict =
        request.num_predict !== undefined
          ? ((isGptOss || isNativeThink) ? request.num_predict + THINKING_OVERHEAD : request.num_predict)
          : undefined

      // Ollama expects model parameters inside an `options` object
      const body: Record<string, unknown> = {
        model:  request.model,
        prompt: request.prompt,
        stream: true,
        ...(thinkValue !== undefined && { think: thinkValue }),
        options: {
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(adjustedNumPredict  !== undefined && { num_predict:  adjustedNumPredict }),
          ...(request.top_p        !== undefined && { top_p:        request.top_p }),
          ...(request.top_k        !== undefined && { top_k:        request.top_k }),
          // Do NOT pass stop sequences for native-thinking models (qwen3, qwq, deepseek-r1).
          // Ollama applies stop sequences to the entire token stream, including thinking tokens.
          // These models emit '\n\n' freely during thinking — the stop fires mid-think,
          // done_reason becomes "stop" with no response, and the fallback sends raw thinking.
          ...(!isNativeThink && request.stop !== undefined && { stop: request.stop }),
        },
      }
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      // stream: true lets TextDecoder buffer incomplete multi-byte sequences
      const decoder = new TextDecoder("utf-8", { fatal: false });

      if (reader) {
        // Accumulate a line buffer across reads so that long JSON lines are
        // never split and passed to JSON.parse mid-line.
        let lineBuffer       = "";
        // Some models (e.g. gpt-oss) stream thinking tokens before response tokens.
        // Buffer thinking so it can be used as a last-resort fallback — but only
        // when the stream finished normally (done_reason:"stop"), NOT when it hit
        // the token limit (done_reason:"length"), which means it was still thinking
        // and never reached the response phase.
        let thinkingBuffer   = "";
        let hadResponseChunk = false;
        let hadThinkingChunk = false;
        let doneReason       = "";

        const processLine = (line: string) => {
          if (!line.trim()) return;
          const json: GenerateResponse & { thinking?: string; done_reason?: string } = JSON.parse(line);

          if (json.done_reason) doneReason = json.done_reason;

          if (json.response) {
            if (!hadResponseChunk && hadThinkingChunk) {
              // Transitioning out of thinking phase — notify UI.
              onThinkingChange?.(false);
            }
            hadResponseChunk = true;
            onChunk(json.response);
          } else if (json.thinking) {
            if (!hadThinkingChunk) {
              // First thinking token — notify UI.
              onThinkingChange?.(true);
              hadThinkingChunk = true;
            }
            thinkingBuffer += json.thinking;
          }

          // For native-thinking models (qwen3, qwq, deepseek-r1), thinking content
          // is chain-of-thought — never a valid completion to surface to the user.
          // The fallback only applies to gpt-oss, where lightweight thinking IS the
          // response when the model has nothing else to say.
          // Also guard against done_reason "length" — that means the model ran out
          // of budget mid-think and the thinking is partial/incomplete.
          if (json.done && !isNativeThink && !hadResponseChunk && thinkingBuffer && doneReason !== "length") {
            onChunk(thinkingBuffer);
            thinkingBuffer = "";
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) processLine(line);
        }
        // Flush any remaining buffered content.
        if (lineBuffer.trim()) processLine(lineBuffer);
        // Edge case: stream closed without a done packet but thinking was buffered.
        // Same guard: don't surface partial thinking from an exhausted budget.
        if (!hadResponseChunk && thinkingBuffer && doneReason !== "length") onChunk(thinkingBuffer);
      }
    } catch (error) {
      logger.error('Ollama', 'Error in streaming:', error);
      throw error;
    }
  }
}

export const ollamaClient = new OllamaClient();
