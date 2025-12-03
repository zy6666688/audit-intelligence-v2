/**
 * 示例插件 - 简单的数据验证插件
 * 演示如何创建一个安全的插件
 */

import type { PluginMetadata } from './PluginSandbox';

/**
 * 插件元数据
 */
export const examplePluginMetadata: PluginMetadata = {
  id: 'data-validator-v1',
  name: '数据验证器',
  version: '1.0.0',
  author: '审计数智析团队',
  description: '验证数据是否符合预定义规则',
  
  permissions: {
    network: {
      allowed: false  // 不需要网络访问
    },
    filesystem: {
      read: false,
      write: false
    },
    api: {
      allowed: true,
      rateLimit: 100  // 每分钟最多100次API调用
    },
    data: {
      canReadUserData: true,
      canWriteUserData: false,
      canAccessSensitiveData: false
    }
  },
  
  quota: {
    maxExecutionTime: 5000,      // 5秒超时
    maxMemoryMB: 100,            // 最大100MB内存
    maxCPUPercent: 50,           // 最大50% CPU
    maxNetworkRequests: 0        // 不允许网络请求
  }
};

/**
 * 插件代码
 * 注意：这段代码会在沙箱中执行
 */
export const examplePluginCode = `
  // 插件主函数
  (function() {
    // 获取输入数据
    const data = inputs.data || [];
    const rules = inputs.rules || {};
    
    console.log('开始数据验证，共 ' + data.length + ' 条记录');
    
    // 验证结果
    const results = {
      valid: [],
      invalid: [],
      summary: {
        total: data.length,
        validCount: 0,
        invalidCount: 0
      }
    };
    
    // 遍历数据进行验证
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const errors = [];
      
      // 检查必填字段
      if (rules.required) {
        for (let field of rules.required) {
          if (!item[field] || item[field] === '') {
            errors.push('缺少必填字段: ' + field);
          }
        }
      }
      
      // 检查数值范围
      if (rules.range) {
        for (let field in rules.range) {
          const value = Number(item[field]);
          const range = rules.range[field];
          
          if (range.min !== undefined && value < range.min) {
            errors.push(field + ' 低于最小值 ' + range.min);
          }
          
          if (range.max !== undefined && value > range.max) {
            errors.push(field + ' 超过最大值 ' + range.max);
          }
        }
      }
      
      // 检查格式
      if (rules.pattern) {
        for (let field in rules.pattern) {
          const value = String(item[field]);
          const pattern = new RegExp(rules.pattern[field]);
          
          if (!pattern.test(value)) {
            errors.push(field + ' 格式不正确');
          }
        }
      }
      
      // 分类结果
      if (errors.length > 0) {
        results.invalid.push({
          index: i,
          data: item,
          errors: errors
        });
        results.summary.invalidCount++;
      } else {
        results.valid.push(item);
        results.summary.validCount++;
      }
    }
    
    console.log('验证完成: ' + results.summary.validCount + ' 条有效, ' + 
                results.summary.invalidCount + ' 条无效');
    
    // 返回结果
    return results;
  })();
`;

/**
 * 数据清洗插件
 */
export const dataCleanerPluginMetadata: PluginMetadata = {
  id: 'data-cleaner-v1',
  name: '数据清洗器',
  version: '1.0.0',
  author: '审计数智析团队',
  description: '清洗和标准化数据',
  
  permissions: {
    network: { allowed: false },
    filesystem: { read: false, write: false },
    api: { allowed: true, rateLimit: 100 },
    data: {
      canReadUserData: true,
      canWriteUserData: true,
      canAccessSensitiveData: false
    }
  },
  
  quota: {
    maxExecutionTime: 10000,
    maxMemoryMB: 200,
    maxCPUPercent: 60,
    maxNetworkRequests: 0
  }
};

export const dataCleanerPluginCode = `
  (function() {
    const data = inputs.data || [];
    const options = inputs.options || {};
    
    console.log('开始数据清洗，共 ' + data.length + ' 条记录');
    
    const cleaned = data.map(function(item) {
      const cleanedItem = {};
      
      for (let key in item) {
        let value = item[key];
        
        // 去除空格
        if (options.trimWhitespace && typeof value === 'string') {
          value = value.trim();
        }
        
        // 转换为小写
        if (options.toLowerCase && typeof value === 'string') {
          value = value.toLowerCase();
        }
        
        // 移除空值
        if (options.removeNull && (value === null || value === undefined)) {
          continue;
        }
        
        // 数字格式化
        if (options.formatNumbers && !isNaN(value)) {
          value = Number(value).toFixed(options.decimalPlaces || 2);
        }
        
        cleanedItem[key] = value;
      }
      
      return cleanedItem;
    });
    
    console.log('数据清洗完成');
    
    return {
      cleaned: cleaned,
      originalCount: data.length,
      cleanedCount: cleaned.length
    };
  })();
`;
