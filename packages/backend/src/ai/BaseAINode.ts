/**
 * BaseAINode - AI节点基类
 * Week 3 Day 2
 */

import type { NodeDefinition, NodeExecuteFn, ExecutionContext } from '@audit/shared';
import type { AIAdapter, AIMessage } from './AIAdapter';
import { PromptTemplate } from './PromptTemplate';

/**
 * AI节点配置
 */
export interface AINodeConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * BaseAINode - AI节点基类
 */
export abstract class BaseAINode {
  protected adapter: AIAdapter;
  protected template?: PromptTemplate;

  constructor(adapter: AIAdapter, template?: string | PromptTemplate) {
    this.adapter = adapter;
    if (template) {
      this.template = typeof template === 'string' 
        ? new PromptTemplate(template) 
        : template;
    }
  }

  /**
   * 构建消息列表
   */
  protected buildMessages(
    userContent: string,
    systemPrompt?: string
  ): AIMessage[] {
    const messages: AIMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: userContent
    });

    return messages;
  }

  /**
   * 执行AI请求
   */
  protected async executeAI(
    prompt: string,
    config?: AINodeConfig
  ): Promise<string> {
    const messages = this.buildMessages(
      prompt,
      config?.systemPrompt
    );

    const response = await this.adapter.chat(messages, {
      model: config?.model,
      temperature: config?.temperature,
      maxTokens: config?.maxTokens
    });

    return response.content;
  }

  /**
   * 渲染模板（如果有）
   */
  protected renderTemplate(variables: Record<string, any>): string {
    if (!this.template) {
      throw new Error('No template defined');
    }
    return this.template.render(variables);
  }

  /**
   * 创建节点定义
   */
  abstract createNodeDefinition(): NodeDefinition;

  /**
   * 执行函数
   */
  abstract execute: NodeExecuteFn;
}

/**
 * 创建简单AI节点
 */
export function createSimpleAINode(
  type: string,
  name: string,
  description: string,
  adapter: AIAdapter,
  promptTemplate: string,
  inputSchema: any,
  outputSchema: any
): NodeDefinition {
  const template = new PromptTemplate(promptTemplate);

  const execute: NodeExecuteFn = async (inputs: any, config: any, context: ExecutionContext) => {
    const prompt = template.render(inputs);
    
    const messages: AIMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await adapter.chat(messages, {
      model: config?.model as string,
      temperature: config?.temperature as number,
      maxTokens: config?.maxTokens as number
    });

    return {
      success: true,
      outputs: {
        result: response.content,
        usage: response.usage
      }
    };
  };

  return {
    manifest: {
      type,
      version: '1.0.0',
      category: 'ai',
      label: { zh: name, en: name },
      description: { zh: description, en: description },
      inputsSchema: inputSchema,
      outputsSchema: outputSchema,
      configSchema: {
        model: { type: 'string', default: 'gpt-3.5-turbo' },
        temperature: { type: 'number', default: 0.7 },
        maxTokens: { type: 'number', default: 1000 }
      },
      capabilities: ['ai' as const],
      metadata: {
        author: 'System',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['ai']
      }
    },
    execute
  };
}
