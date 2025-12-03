/**
 * OpenAIAdapter测试
 * Week 3 Day 1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AIError } from './AIAdapter';

// Mock global fetch
global.fetch = vi.fn();

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    adapter = new OpenAIAdapter({
      apiKey: 'test-key',
      defaultModel: 'gpt-3.5-turbo'
    });
    vi.clearAllMocks();
  });

  describe('基本功能', () => {
    it('应该正确初始化', () => {
      expect(adapter.getName()).toBe('OpenAI');
    });
  });

  describe('chat方法', () => {
    it('应该成功调用API', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Hello!' },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await adapter.chat([
        { role: 'user', content: 'Hi' }
      ]);

      expect(result.content).toBe('Hello!');
      expect(result.finishReason).toBe('stop');
      expect(result.usage?.totalTokens).toBe(15);
    });

    it('应该处理API错误', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid API key',
            code: 'invalid_api_key'
          }
        })
      });

      await expect(adapter.chat([
        { role: 'user', content: 'Hi' }
      ])).rejects.toThrow(AIError);
    });

    it('应该处理网络错误', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.chat([
        { role: 'user', content: 'Hi' }
      ])).rejects.toThrow('Network error');
    });
  });

  describe('配置', () => {
    it('应该使用自定义模型', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await adapter.chat([{ role: 'user', content: 'Test' }], {
        model: 'gpt-4'
      });

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('gpt-4');
    });

    it('应该设置temperature', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await adapter.chat([{ role: 'user', content: 'Test' }], {
        temperature: 0.5
      });

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.temperature).toBe(0.5);
    });
  });
});
