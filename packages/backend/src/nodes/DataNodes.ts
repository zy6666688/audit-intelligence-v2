/**
 * 数据处理节点实现
 * 提供常用的数据转换和处理节点
 */

import type { NodeDefinition, NodeManifest, ExecutionContext } from '@audit/shared';

/**
 * CSV读取节点
 */
export function createCSVReaderNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'data.csv_reader',
    version: '1.0.0',
    category: 'input',
    label: { zh: 'CSV读取', en: 'CSV Reader' },
    description: { zh: '读取CSV文件并解析为数据', en: 'Read and parse CSV file' },
    icon: '📄',
    
    inputsSchema: {
      filePath: {
        type: 'string',
        description: 'CSV文件路径',
        required: true
      }
    },
    
    outputsSchema: {
      data: {
        type: 'array',
        description: '解析后的数据'
      },
      headers: {
        type: 'array',
        description: '列标题'
      }
    },
    
    configSchema: {
      delimiter: {
        type: 'string',
        description: '分隔符',
        default: ','
      },
      hasHeader: {
        type: 'boolean',
        description: '是否包含标题行',
        default: true
      },
      encoding: {
        type: 'string',
        description: '文件编码',
        default: 'utf-8'
      }
    },
    
    capabilities: ['io-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['data', 'input', 'csv']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { filePath } = inputs;
    const { delimiter = ',', hasHeader = true, encoding = 'utf-8' } = config;

    // 实际实现需要读取文件
    // 这里返回模拟数据
    const mockData = [
      { id: '1', name: '张三', amount: '1000' },
      { id: '2', name: '李四', amount: '2000' },
      { id: '3', name: '王五', amount: '3000' }
    ];

    const headers = Object.keys(mockData[0]);

    return {
      data: mockData,
      headers,
      rowCount: mockData.length,
      filePath
    };
  };

  return { manifest, execute };
}

/**
 * 数据过滤节点
 */
export function createFilterNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'data.filter',
    version: '1.0.0',
    category: 'transformation',
    label: { zh: '数据过滤', en: 'Filter' },
    description: { zh: '按条件过滤数据行', en: 'Filter data rows by conditions' },
    icon: '🔍',
    
    inputsSchema: {
      data: {
        type: 'array',
        description: '输入数据',
        required: true
      }
    },
    
    outputsSchema: {
      filtered: {
        type: 'array',
        description: '过滤后的数据'
      },
      rejected: {
        type: 'array',
        description: '被过滤掉的数据'
      }
    },
    
    configSchema: {
      field: {
        type: 'string',
        description: '过滤字段',
        required: true
      },
      operator: {
        type: 'string',
        enum: ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual'],
        description: '比较操作符',
        default: 'equals'
      },
      value: {
        type: 'any',
        description: '比较值',
        required: true
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['data', 'filter', 'transformation']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { data } = inputs;
    const { field, operator, value } = config;

    const filtered: any[] = [];
    const rejected: any[] = [];

    data.forEach((item: any) => {
      const fieldValue = item[field];
      let match = false;

      switch (operator) {
        case 'equals':
          match = fieldValue == value;
          break;
        case 'notEquals':
          match = fieldValue != value;
          break;
        case 'contains':
          match = String(fieldValue).includes(String(value));
          break;
        case 'greaterThan':
          match = Number(fieldValue) > Number(value);
          break;
        case 'lessThan':
          match = Number(fieldValue) < Number(value);
          break;
        case 'greaterThanOrEqual':
          match = Number(fieldValue) >= Number(value);
          break;
        case 'lessThanOrEqual':
          match = Number(fieldValue) <= Number(value);
          break;
      }

      if (match) {
        filtered.push(item);
      } else {
        rejected.push(item);
      }
    });

    return {
      filtered,
      rejected,
      filteredCount: filtered.length,
      rejectedCount: rejected.length,
      totalCount: data.length
    };
  };

  return { manifest, execute };
}

/**
 * 数据映射节点
 */
export function createMapNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'data.map',
    version: '1.0.0',
    category: 'transformation',
    label: { zh: '数据映射', en: 'Map' },
    description: { zh: '转换数据字段', en: 'Transform data fields' },
    icon: '🔄',
    
    inputsSchema: {
      data: {
        type: 'array',
        description: '输入数据',
        required: true
      }
    },
    
    outputsSchema: {
      mapped: {
        type: 'array',
        description: '映射后的数据'
      }
    },
    
    configSchema: {
      fieldMappings: {
        type: 'object',
        description: '字段映射规则 {新字段名: 旧字段名}',
        required: true
      },
      keepOriginal: {
        type: 'boolean',
        description: '是否保留原始字段',
        default: false
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['data', 'map', 'transformation']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { data } = inputs;
    const { fieldMappings, keepOriginal = false } = config;

    const mapped = data.map((item: any) => {
      const newItem: any = keepOriginal ? { ...item } : {};

      for (const [newField, oldField] of Object.entries(fieldMappings)) {
        newItem[newField] = item[oldField as string];
      }

      return newItem;
    });

    return {
      mapped,
      count: mapped.length
    };
  };

  return { manifest, execute };
}

/**
 * 数据聚合节点
 */
export function createAggregateNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'data.aggregate',
    version: '1.0.0',
    category: 'transformation',
    label: { zh: '数据聚合', en: 'Aggregate' },
    description: { zh: '按字段分组并聚合', en: 'Group by field and aggregate' },
    icon: '📊',
    
    inputsSchema: {
      data: {
        type: 'array',
        description: '输入数据',
        required: true
      }
    },
    
    outputsSchema: {
      aggregated: {
        type: 'array',
        description: '聚合后的数据'
      }
    },
    
    configSchema: {
      groupBy: {
        type: 'array',
        description: '分组字段列表',
        required: true
      },
      aggregations: {
        type: 'object',
        description: '聚合规则 {字段名: {function: "sum|avg|count|min|max", sourceField: "xxx"}}',
        required: true
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['data', 'aggregate', 'transformation']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { data } = inputs;
    const { groupBy, aggregations } = config;

    const groups = new Map<string, any[]>();

    // 分组
    data.forEach((item: any) => {
      const key = groupBy.map((field: string) => item[field]).join('||');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    // 聚合
    const aggregated: any[] = [];
    for (const [key, items] of groups) {
      const result: any = {};
      
      // 设置分组字段
      groupBy.forEach((field: string, index: number) => {
        result[field] = items[0][field];
      });

      // 计算聚合值
      for (const [aggField, aggConfig] of Object.entries(aggregations as any)) {
        const { function: func, sourceField } = aggConfig as any;
        const values = items.map(item => Number(item[sourceField]) || 0);

        switch (func) {
          case 'sum':
            result[aggField] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[aggField] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'count':
            result[aggField] = items.length;
            break;
          case 'min':
            result[aggField] = Math.min(...values);
            break;
          case 'max':
            result[aggField] = Math.max(...values);
            break;
        }
      }

      aggregated.push(result);
    }

    return {
      aggregated,
      groupCount: aggregated.length,
      originalCount: data.length
    };
  };

  return { manifest, execute };
}

/**
 * 导出所有数据节点
 */
export const dataNodes = [
  createCSVReaderNode(),
  createFilterNode(),
  createMapNode(),
  createAggregateNode()
];
