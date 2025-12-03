/**
 * 国际化工具
 * 支持节点标签和描述的多语言切换
 */

export type Language = 'zh' | 'en';

export interface LocalizedText {
  zh: string;
  en: string;
}

/**
 * 获取本地化文本
 */
export function getLocalizedText(
  text: LocalizedText | string,
  lang: Language = 'zh'
): string {
  if (typeof text === 'string') {
    return text;
  }
  return text[lang] || text.zh || text.en || '';
}

/**
 * 节点分类翻译
 */
export const categoryTranslations: Record<string, LocalizedText> = {
  utility: {
    zh: '实用工具',
    en: 'Utility'
  },
  input: {
    zh: '数据输入',
    en: 'Input'
  },
  transformation: {
    zh: '数据转换',
    en: 'Transformation'
  },
  audit: {
    zh: '审计分析',
    en: 'Audit'
  },
  output: {
    zh: '数据输出',
    en: 'Output'
  },
  analysis: {
    zh: '数据分析',
    en: 'Analysis'
  }
};

/**
 * 获取分类的本地化名称
 */
export function getCategoryName(category: string, lang: Language = 'zh'): string {
  const translation = categoryTranslations[category];
  return translation ? getLocalizedText(translation, lang) : category;
}

/**
 * 字段类型翻译
 */
export const fieldTypeTranslations: Record<string, LocalizedText> = {
  string: { zh: '文本', en: 'String' },
  number: { zh: '数字', en: 'Number' },
  boolean: { zh: '布尔值', en: 'Boolean' },
  array: { zh: '数组', en: 'Array' },
  object: { zh: '对象', en: 'Object' },
  date: { zh: '日期', en: 'Date' },
  any: { zh: '任意类型', en: 'Any' }
};

/**
 * 获取字段类型的本地化名称
 */
export function getFieldTypeName(type: string, lang: Language = 'zh'): string {
  const translation = fieldTypeTranslations[type];
  return translation ? getLocalizedText(translation, lang) : type;
}

/**
 * 常用操作符翻译
 */
export const operatorTranslations: Record<string, LocalizedText> = {
  '==': { zh: '等于', en: 'Equals' },
  '!=': { zh: '不等于', en: 'Not Equals' },
  '>': { zh: '大于', en: 'Greater Than' },
  '<': { zh: '小于', en: 'Less Than' },
  '>=': { zh: '大于等于', en: 'Greater Than or Equals' },
  '<=': { zh: '小于等于', en: 'Less Than or Equals' },
  'contains': { zh: '包含', en: 'Contains' },
  'startsWith': { zh: '开始于', en: 'Starts With' },
  'endsWith': { zh: '结束于', en: 'Ends With' }
};

/**
 * 状态翻译
 */
export const statusTranslations: Record<string, LocalizedText> = {
  pending: { zh: '待处理', en: 'Pending' },
  running: { zh: '运行中', en: 'Running' },
  success: { zh: '成功', en: 'Success' },
  failed: { zh: '失败', en: 'Failed' },
  cancelled: { zh: '已取消', en: 'Cancelled' }
};

/**
 * 风险等级翻译
 */
export const riskLevelTranslations: Record<string, LocalizedText> = {
  low: { zh: '低风险', en: 'Low Risk' },
  medium: { zh: '中等风险', en: 'Medium Risk' },
  high: { zh: '高风险', en: 'High Risk' },
  critical: { zh: '严重风险', en: 'Critical Risk' }
};

/**
 * 通用消息翻译
 */
export const commonMessages: Record<string, LocalizedText> = {
  required: { zh: '必填', en: 'Required' },
  optional: { zh: '可选', en: 'Optional' },
  loading: { zh: '加载中...', en: 'Loading...' },
  success: { zh: '操作成功', en: 'Success' },
  error: { zh: '操作失败', en: 'Error' },
  confirm: { zh: '确认', en: 'Confirm' },
  cancel: { zh: '取消', en: 'Cancel' },
  save: { zh: '保存', en: 'Save' },
  delete: { zh: '删除', en: 'Delete' },
  edit: { zh: '编辑', en: 'Edit' },
  add: { zh: '添加', en: 'Add' },
  search: { zh: '搜索', en: 'Search' },
  filter: { zh: '筛选', en: 'Filter' },
  export: { zh: '导出', en: 'Export' },
  import: { zh: '导入', en: 'Import' }
};

/**
 * 格式化节点信息为指定语言
 */
export function formatNodeInfo(node: any, lang: Language = 'zh') {
  return {
    ...node,
    label: getLocalizedText(node.label, lang),
    description: getLocalizedText(node.description, lang),
    category: getCategoryName(node.category, lang)
  };
}

/**
 * 批量格式化节点列表
 */
export function formatNodeList(nodes: any[], lang: Language = 'zh') {
  return nodes.map(node => formatNodeInfo(node, lang));
}
