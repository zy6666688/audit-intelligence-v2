/**
 * AIAdapter - AI服务适配器接口
 * Week 3 Day 1
 * 
 * 统一的AI API接口，支持多种AI服务
 */

/**
 * AI请求消息
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * AI请求配置
 */
export interface AIRequestConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
}

/**
 * AI响应
 */
export interface AIResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 流式响应块
 */
export interface AIStreamChunk {
  content: string;
  done: boolean;
}

/**
 * AI适配器接口
 */
export interface AIAdapter {
  /**
   * 发送请求
   */
  chat(messages: AIMessage[], config?: AIRequestConfig): Promise<AIResponse>;

  /**
   * 流式请求
   */
  chatStream(
    messages: AIMessage[],
    config?: AIRequestConfig
  ): AsyncIterableIterator<AIStreamChunk>;

  /**
   * 获取适配器名称
   */
  getName(): string;

  /**
   * 检查健康状态
   */
  healthCheck(): Promise<boolean>;
}

/**
 * AI错误
 */
export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}
