/**
 * OpenAIAdapter - OpenAI API适配器
 * Week 3 Day 1
 */

import type {
  AIAdapter,
  AIMessage,
  AIRequestConfig,
  AIResponse,
  AIStreamChunk
} from './AIAdapter';
import { AIError } from './AIAdapter';

/**
 * OpenAI配置
 */
export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  defaultModel?: string;
  timeout?: number;
}

/**
 * OpenAI适配器
 */
export class OpenAIAdapter implements AIAdapter {
  private apiKey: string;
  private baseURL: string;
  private organization?: string;
  private defaultModel: string;
  private timeout: number;

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.organization = config.organization;
    this.defaultModel = config.defaultModel || 'gpt-3.5-turbo';
    this.timeout = config.timeout || 60000;
  }

  getName(): string {
    return 'OpenAI';
  }

  async chat(messages: AIMessage[], config?: AIRequestConfig): Promise<AIResponse> {
    const requestBody = {
      model: config?.model || this.defaultModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: config?.temperature || 0.7,
      max_tokens: config?.maxTokens,
      stream: false
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new AIError(
          error.error?.message || `HTTP ${response.status}`,
          error.error?.code || 'unknown_error',
          response.status
        );
      }

      const data = await response.json();
      const choice = data.choices[0];

      return {
        content: choice.message.content,
        finishReason: choice.finish_reason === 'stop' ? 'stop' : 
                     choice.finish_reason === 'length' ? 'length' : 'error',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };

    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError('Request timeout', 'timeout');
      }
      throw new AIError(
        error instanceof Error ? error.message : 'Unknown error',
        'request_failed'
      );
    }
  }

  async *chatStream(
    messages: AIMessage[],
    config?: AIRequestConfig
  ): AsyncIterableIterator<AIStreamChunk> {
    const requestBody = {
      model: config?.model || this.defaultModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: config?.temperature || 0.7,
      max_tokens: config?.maxTokens,
      stream: true
    };

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new AIError(
          error.error?.message || `HTTP ${response.status}`,
          error.error?.code || 'unknown_error',
          response.status
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new AIError('No response body', 'no_body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              yield { content: '', done: true };
              return;
            }

            try {
              const json = JSON.parse(data);
              const delta = json.choices[0]?.delta;
              
              if (delta?.content) {
                yield { content: delta.content, done: false };
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        error instanceof Error ? error.message : 'Stream failed',
        'stream_failed'
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.chat([
        { role: 'user', content: 'ping' }
      ], { maxTokens: 5 });
      return response.content.length > 0;
    } catch {
      return false;
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    return headers;
  }
}
