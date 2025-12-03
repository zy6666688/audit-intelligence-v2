/**
 * Echo节点（回显节点）
 * Week 1 Day 2 - 测试节点
 * 用于测试任意类型的数据传递
 */

import type { NodeDefinition } from '@audit/shared';

export const echoNode: NodeDefinition = {
  manifest: {
    type: 'echo',
    version: '1.0.0',
    category: 'utility',
    label: {
      zh: '回显',
      en: 'Echo'
    },
    description: {
      zh: '返回输入的数据，用于测试和调试',
      en: 'Echo back the input data, useful for testing'
    },
    icon: 'repeat',
    
    inputsSchema: {
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          description: '要回显的值（任意类型）'
        },
        prefix: {
          type: 'string',
          description: '可选的前缀（仅对字符串有效）'
        }
      }
    },
    
    outputsSchema: {
      type: 'object',
      required: ['echoed'],
      properties: {
        echoed: {
          description: '回显的值'
        },
        type: {
          type: 'string',
          description: '值的类型'
        }
      }
    },
    
    capabilities: ['cpu-bound'],
    
    estimatedCost: {
      timeMs: 1,
      memoryMB: 1
    },
    
    cachePolicy: {
      enabled: false,
      ttl: 0,
      keyFields: []
    },// Echo不需要缓存
    
    examples: [
      {
        name: '字符串回显',
        inputs: { value: 'Hello, World!' },
        expectedOutputs: { 
          echoed: 'Hello, World!',
          type: 'string'
        }
      },
      {
        name: '数字回显',
        inputs: { value: 42 },
        expectedOutputs: { 
          echoed: 42,
          type: 'number'
        }
      },
      {
        name: '对象回显',
        inputs: { 
          value: { name: 'Test', age: 25 }
        },
        expectedOutputs: { 
          echoed: { name: 'Test', age: 25 },
          type: 'object'
        }
      },
      {
        name: '带前缀的字符串',
        inputs: { 
          value: 'World',
          prefix: 'Hello, '
        },
        expectedOutputs: { 
          echoed: 'Hello, World',
          type: 'string'
        }
      }
    ],
    
    metadata: {
      author: '审计数智析团队',
      createdAt: '2023-11-30',
      updatedAt: '2023-11-30',
      tags: ['utility', 'test', 'debug']
    }
  },
  
  execute: async (inputs, config, context) => {
    let { value, prefix } = inputs;
    
    // 如果有前缀且value是字符串，则添加前缀
    if (prefix && typeof value === 'string') {
      value = prefix + value;
    }
    
    // 获取类型
    const type = Array.isArray(value) ? 'array' : typeof value;
    
    context.logger?.debug(`Echo: ${JSON.stringify(value)} (${type})`);
    
    return {
      echoed: value,
      type
    };
  }
};
