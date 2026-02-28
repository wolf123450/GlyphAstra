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
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      // GPT-OSS requires think:"low"|"medium"|"high" — it ignores true/false.
      // Other thinking models (qwen3, deepseek-r1) default to thinking enabled,
      // so we leave `think` unset for them (Ollama's default behaviour).
      const isGptOss = request.model.toLowerCase().startsWith('gpt-oss')
      const thinkValue: string | undefined = isGptOss ? 'low' : undefined

      // Thinking tokens count toward num_predict. Add headroom so the model
      // can finish reasoning before starting the actual response.
      const THINKING_OVERHEAD = 2048
      const adjustedNumPredict =
        request.num_predict !== undefined
          ? request.num_predict + THINKING_OVERHEAD
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
          ...(request.stop         !== undefined && { stop:         request.stop }),
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
        let doneReason       = "";

        const processLine = (line: string) => {
          if (!line.trim()) return;
          const json: GenerateResponse & { thinking?: string; done_reason?: string } = JSON.parse(line);

          if (json.done_reason) doneReason = json.done_reason;

          if (json.response) {
            hadResponseChunk = true;
            onChunk(json.response);
          } else if (json.thinking) {
            thinkingBuffer += json.thinking;
          }

          // Only fall back to the thinking buffer when the stream completed
          // normally. If done_reason is "length" the model ran out of tokens
          // mid-think — returning partial reasoning as a suggestion would be
          // worse than returning nothing.
          if (json.done && !hadResponseChunk && thinkingBuffer && doneReason !== "length") {
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
