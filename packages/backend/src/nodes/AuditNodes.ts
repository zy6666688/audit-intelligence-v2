/**
 * 审计专用节点实现
 * 提供常用的审计业务节点
 */

import type { NodeDefinition, NodeManifest, ExecutionContext } from '@audit/shared';

/**
 * 数据对比节点 - 对比两组数据的差异
 */
export function createDataCompareNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'audit.data_compare',
    version: '1.0.0',
    category: 'audit',
    label: { zh: '数据对比', en: 'Data Compare' },
    description: { zh: '对比两组数据，找出差异项', en: 'Compare two datasets and find differences' },
    icon: '📊',
    
    inputsSchema: {
      source1: {
        type: 'array',
        description: '数据源1',
        required: true
      },
      source2: {
        type: 'array',
        description: '数据源2',
        required: true
      },
      keyField: {
        type: 'string',
        description: '主键字段',
        required: true
      }
    },
    
    outputsSchema: {
      matches: {
        type: 'array',
        description: '匹配的记录'
      },
      onlyInSource1: {
        type: 'array',
        description: '仅在数据源1中存在'
      },
      onlyInSource2: {
        type: 'array',
        description: '仅在数据源2中存在'
      },
      differences: {
        type: 'array',
        description: '值不同的记录'
      }
    },
    
    configSchema: {
      compareFields: {
        type: 'array',
        description: '要对比的字段列表',
        default: []
      },
      ignoreCase: {
        type: 'boolean',
        description: '是否忽略大小写',
        default: false
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['audit', 'compare', 'data']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { source1, source2, keyField } = inputs;
    const { compareFields = [], ignoreCase = false } = config;

    // 构建索引
    const map1 = new Map();
    const map2 = new Map();
    
    source1.forEach((item: any) => {
      const key = item[keyField];
      map1.set(key, item);
    });
    
    source2.forEach((item: any) => {
      const key = item[keyField];
      map2.set(key, item);
    });

    // 对比结果
    const matches: any[] = [];
    const onlyInSource1: any[] = [];
    const onlyInSource2: any[] = [];
    const differences: any[] = [];

    // 检查source1
    for (const [key, item1] of map1) {
      if (map2.has(key)) {
        const item2 = map2.get(key);
        
        // 检查字段差异
        const diffs: any = { key };
        let hasDiff = false;
        
        const fieldsToCompare = compareFields.length > 0 
          ? compareFields 
          : Object.keys(item1).filter(k => k !== keyField);
        
        for (const field of fieldsToCompare) {
          let val1 = item1[field];
          let val2 = item2[field];
          
          if (ignoreCase && typeof val1 === 'string' && typeof val2 === 'string') {
            val1 = val1.toLowerCase();
            val2 = val2.toLowerCase();
          }
          
          if (val1 !== val2) {
            diffs[field] = { source1: item1[field], source2: item2[field] };
            hasDiff = true;
          }
        }
        
        if (hasDiff) {
          differences.push(diffs);
        } else {
          matches.push(item1);
        }
      } else {
        onlyInSource1.push(item1);
      }
    }

    // 检查source2中独有的
    for (const [key, item2] of map2) {
      if (!map1.has(key)) {
        onlyInSource2.push(item2);
      }
    }

    return {
      matches,
      onlyInSource1,
      onlyInSource2,
      differences,
      summary: {
        total1: source1.length,
        total2: source2.length,
        matches: matches.length,
        onlyInSource1: onlyInSource1.length,
        onlyInSource2: onlyInSource2.length,
        differences: differences.length
      }
    };
  };

  return { manifest, execute };
}

/**
 * 金额计算节点 - 对金额列进行统计计算
 */
export function createAmountCalculateNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'audit.amount_calculate',
    version: '1.0.0',
    category: 'audit',
    label: { zh: '金额计算', en: 'Amount Calculate' },
    description: { zh: '对金额数据进行求和、平均值等计算', en: 'Calculate sum, average, etc. for amount data' },
    icon: '💰',
    
    inputsSchema: {
      data: {
        type: 'array',
        description: '输入数据',
        required: true
      },
      amountField: {
        type: 'string',
        description: '金额字段名',
        required: true
      }
    },
    
    outputsSchema: {
      sum: { type: 'number', description: '总和' },
      average: { type: 'number', description: '平均值' },
      max: { type: 'number', description: '最大值' },
      min: { type: 'number', description: '最小值' },
      count: { type: 'number', description: '记录数' }
    },
    
    configSchema: {
      precision: {
        type: 'number',
        description: '小数位数',
        default: 2
      },
      groupByField: {
        type: 'string',
        description: '分组字段（可选）'
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['audit', 'calculate', 'amount']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { data, amountField } = inputs;
    const { precision = 2, groupByField } = config;

    const round = (num: number) => Math.round(num * Math.pow(10, precision)) / Math.pow(10, precision);

    if (groupByField) {
      // 分组计算
      const groups = new Map<string, number[]>();
      
      data.forEach((item: any) => {
        const groupKey = item[groupByField];
        const amount = parseFloat(item[amountField]) || 0;
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(amount);
      });

      const results: any[] = [];
      for (const [groupKey, amounts] of groups) {
        const sum = amounts.reduce((a, b) => a + b, 0);
        results.push({
          group: groupKey,
          sum: round(sum),
          average: round(sum / amounts.length),
          max: round(Math.max(...amounts)),
          min: round(Math.min(...amounts)),
          count: amounts.length
        });
      }

      return { groups: results };
    } else {
      // 整体计算
      const amounts = data.map((item: any) => parseFloat(item[amountField]) || 0);
      const sum = amounts.reduce((a: number, b: number) => a + b, 0);

      return {
        sum: round(sum),
        average: round(sum / amounts.length),
        max: round(Math.max(...amounts)),
        min: round(Math.min(...amounts)),
        count: amounts.length
      };
    }
  };

  return { manifest, execute };
}

/**
 * 抽样选择节点 - 按规则抽取样本
 */
export function createSamplingNode(): NodeDefinition {
  const manifest: NodeManifest = {
    type: 'audit.sampling',
    version: '1.0.0',
    category: 'audit',
    label: { zh: '审计抽样', en: 'Audit Sampling' },
    description: { zh: '按照审计要求进行数据抽样', en: 'Sample data according to audit requirements' },
    icon: '🎲',
    
    inputsSchema: {
      data: {
        type: 'array',
        description: '输入数据',
        required: true
      }
    },
    
    outputsSchema: {
      samples: {
        type: 'array',
        description: '抽样结果'
      },
      samplingRate: {
        type: 'number',
        description: '抽样率'
      }
    },
    
    configSchema: {
      method: {
        type: 'string',
        enum: ['random', 'systematic', 'stratified', 'top'],
        description: '抽样方法',
        default: 'random'
      },
      sampleSize: {
        type: 'number',
        description: '样本数量',
        default: 10
      },
      sampleRate: {
        type: 'number',
        description: '抽样比例(0-1)',
        default: 0.1
      },
      stratifyField: {
        type: 'string',
        description: '分层字段（分层抽样时使用）'
      },
      sortField: {
        type: 'string',
        description: '排序字段（Top-N时使用）'
      }
    },
    
    capabilities: ['cpu-bound'],
    
    metadata: {
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['audit', 'sampling']
    }
  };

  const execute = async (inputs: any, config: any, context: ExecutionContext) => {
    const { data } = inputs;
    const { method = 'random', sampleSize = 10, sampleRate = 0.1, stratifyField, sortField } = config;

    let samples: any[] = [];
    const totalCount = data.length;
    const targetSize = Math.min(sampleSize, Math.ceil(totalCount * sampleRate));

    switch (method) {
      case 'random':
        // 随机抽样
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        samples = shuffled.slice(0, targetSize);
        break;

      case 'systematic':
        // 系统抽样
        const interval = Math.floor(totalCount / targetSize);
        const start = Math.floor(Math.random() * interval);
        for (let i = start; i < totalCount && samples.length < targetSize; i += interval) {
          samples.push(data[i]);
        }
        break;

      case 'stratified':
        // 分层抽样
        if (!stratifyField) {
          throw new Error('分层抽样需要指定stratifyField');
        }
        const strata = new Map<string, any[]>();
        data.forEach((item: any) => {
          const key = item[stratifyField];
          if (!strata.has(key)) {
            strata.set(key, []);
          }
          strata.get(key)!.push(item);
        });
        
        strata.forEach((items) => {
          const strataSize = Math.ceil(items.length / totalCount * targetSize);
          const strataSamples = items.sort(() => Math.random() - 0.5).slice(0, strataSize);
          samples.push(...strataSamples);
        });
        break;

      case 'top':
        // Top-N抽样
        if (!sortField) {
          throw new Error('Top-N抽样需要指定sortField');
        }
        samples = [...data]
          .sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0))
          .slice(0, targetSize);
        break;
    }

    return {
      samples,
      samplingRate: samples.length / totalCount,
      originalCount: totalCount,
      sampleCount: samples.length,
      method
    };
  };

  return { manifest, execute };
}

/**
 * 导出所有审计节点
 */
export const auditNodes = [
  createDataCompareNode(),
  createAmountCalculateNode(),
  createSamplingNode()
];
