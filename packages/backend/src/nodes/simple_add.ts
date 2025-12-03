/**
 * 简单加法节点
 * Week 1 Day 2 - 测试节点
 */

import type { NodeDefinition } from '@audit/shared';

export const simpleAddNode: NodeDefinition = {
  manifest: {
    type: 'simple_add',
    version: '1.0.0',
    category: 'utility',
    label: {
      zh: '简单加法',
      en: 'Simple Add'
    },
    description: {
      zh: '将两个数字相加',
      en: 'Add two numbers together'
    },
    icon: 'calculator',
    
    // 输入Schema
    inputsSchema: {
      type: 'object',
      required: ['a', 'b'],
      properties: {
        a: {
          type: 'number',
          description: '第一个数字'
        },
        b: {
          type: 'number',
          description: '第二个数字'
        }
      }
    },
    
    // 输出Schema
    outputsSchema: {
      type: 'object',
      required: ['result'],
      properties: {
        result: {
          type: 'number',
          description: '相加的结果'
        }
      }
    },
    
    // 能力标签
    capabilities: ['cpu-bound'],
    
    // 性能估算
    estimatedCost: {
      timeMs: 5,
      memoryMB: 1
    },
    
    // 缓存策略
    cachePolicy: {
      enabled: true,
      ttl: 3600,
      keyFields: ['a', 'b']
    },
    
    // 测试示例
    examples: [
      {
        name: '正整数加法',
        inputs: { a: 5, b: 3 },
        expectedOutputs: { result: 8 }
      },
      {
        name: '负数加法',
        inputs: { a: -5, b: 3 },
        expectedOutputs: { result: -2 }
      },
      {
        name: '小数加法',
        inputs: { a: 1.5, b: 2.5 },
        expectedOutputs: { result: 4 }
      },
      {
        name: '零加法',
        inputs: { a: 0, b: 0 },
        expectedOutputs: { result: 0 }
      }
    ],
    
    // 元数据
    metadata: {
      author: '审计数智析团队',
      createdAt: '2023-11-30',
      updatedAt: '2023-11-30',
      tags: ['math', 'utility', 'test'],
      documentation: 'https://docs.example.com/nodes/simple_add'
    }
  },
  
  // 执行函数
  execute: async (inputs, config, context) => {
    const { a, b } = inputs;
    
    context.logger?.debug(`Computing ${a} + ${b}`);
    
    // 简单的加法运算
    const result = a + b;
    
    context.logger?.debug(`Result: ${result}`);
    
    return { result };
  }
};
