/**
 * 简单乘法节点
 * Week 1 Day 2 - 测试节点
 */

import type { NodeDefinition } from '@audit/shared';

export const simpleMultiplyNode: NodeDefinition = {
  manifest: {
    type: 'simple_multiply',
    version: '1.0.0',
    category: 'utility',
    label: {
      zh: '简单乘法',
      en: 'Simple Multiply'
    },
    description: {
      zh: '将两个数字相乘',
      en: 'Multiply two numbers'
    },
    icon: 'calculator',
    
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
    
    outputsSchema: {
      type: 'object',
      required: ['result'],
      properties: {
        result: {
          type: 'number',
          description: '相乘的结果'
        }
      }
    },
    
    capabilities: ['cpu-bound'],
    
    estimatedCost: {
      timeMs: 5,
      memoryMB: 1
    },
    
    cachePolicy: {
      enabled: true,
      ttl: 3600,
      keyFields: ['a', 'b']
    },
    
    examples: [
      {
        name: '正整数乘法',
        inputs: { a: 5, b: 3 },
        expectedOutputs: { result: 15 }
      },
      {
        name: '负数乘法',
        inputs: { a: -5, b: 3 },
        expectedOutputs: { result: -15 }
      },
      {
        name: '小数乘法',
        inputs: { a: 2.5, b: 4 },
        expectedOutputs: { result: 10 }
      },
      {
        name: '零乘法',
        inputs: { a: 5, b: 0 },
        expectedOutputs: { result: 0 }
      }
    ],
    
    metadata: {
      author: '审计数智析团队',
      createdAt: '2023-11-30',
      updatedAt: '2023-11-30',
      tags: ['math', 'utility', 'test']
    }
  },
  
  execute: async (inputs, config, context) => {
    const { a, b } = inputs;
    
    context.logger?.debug(`Computing ${a} × ${b}`);
    
    const result = a * b;
    
    context.logger?.debug(`Result: ${result}`);
    
    return { result };
  }
};
