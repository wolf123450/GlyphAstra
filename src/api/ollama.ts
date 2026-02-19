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
      console.error("Ollama connection error:", error);
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
      console.error("Error fetching models:", error);
      return [];
    }
  }

  /**
   * Generate text completion
   */
  async generate(request: GenerateRequest): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let fullResponse = "";

      if (request.stream) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
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
        }
      } else {
        const data: GenerateResponse = await response.json();
        fullResponse = data.response;
      }

      return fullResponse;
    } catch (error) {
      console.error("Error generating text:", error);
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
      // Ollama expects model parameters inside an `options` object
      const body: Record<string, unknown> = {
        model:  request.model,
        prompt: request.prompt,
        stream: true,
        options: {
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(request.num_predict  !== undefined && { num_predict:  request.num_predict }),
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
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.trim()) {
              const json: GenerateResponse = JSON.parse(line);
              onChunk(json.response);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in streaming:", error);
      throw error;
    }
  }
}

export const ollamaClient = new OllamaClient();
