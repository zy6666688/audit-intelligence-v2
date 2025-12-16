import { nodeRegistry, NodeDefinition } from '@/core/registry/NodeRegistry';

export type Language = 'zh' | 'en';

// 兼容老节点：端口命名只有 snake_case 英文时的备用翻译表
const legacyPortNameMap: Record<string, { zh: string; en?: string }> = {
  // 通用
  dataframe: { zh: '数据框' },
  report: { zh: '报告' },
  outliers: { zh: '异常行' },
  file_path: { zh: '文件路径' },
  storage_path: { zh: '存储路径' },
  workflow_id: { zh: '工作流ID' },
  file_type_hint: { zh: '文件类型提示' },
  file_metadata: { zh: '文件元数据' },

  column_name: { zh: '列名' },
  min_value: { zh: '最小值' },
  max_value: { zh: '最大值' },
  max_rows: { zh: '最大行数' },
  include_index: { zh: '包含索引' },
  html_table: { zh: 'HTML表' },
  chart_type: { zh: '图表类型' },
  x_column: { zh: 'X轴列' },
  y_column: { zh: 'Y轴列' },
  title: { zh: '标题' },
  legend_show: { zh: '显示图例' },
  echarts_option: { zh: '图表配置' },

  // 文本/报告类
  text_data: { zh: '文本数据' },
  task_type: { zh: '任务类型' },
  text_labels: { zh: '文本标签' },
  key_sentences: { zh: '关键句' },
  extracted_info: { zh: '提取信息' },

  // 数据清洗/映射
  mapping_json: { zh: '列名映射' },
  keep_other_columns: { zh: '保留其他列' },
  strict_mode: { zh: '严格模式' },
  strategy: { zh: '策略' },
  target_columns: { zh: '目标列' },
  custom_value: { zh: '自定义值' },
  cleaned_df: { zh: '清洗后数据' },
};

/**
 * 翻译服务
 * 提供节点和端口名称的中英文翻译功能
 */
export class Translator {
  private language: Language = 'zh';

  /**
   * 设置当前语言
   */
  setLanguage(lang: Language) {
    this.language = lang;
  }

  /**
   * 获取当前语言
   */
  getLanguage(): Language {
    return this.language;
  }

  /**
   * 切换语言
   */
  toggleLanguage() {
    this.language = this.language === 'zh' ? 'en' : 'zh';
    return this.language;
  }

  /**
   * 翻译节点标题
   */
  translateNodeTitle(nodeType: string): string {
    const def = nodeRegistry.getNodeDefinition(nodeType);
    if (!def) return nodeType;

    // 如果当前是英文且节点定义有英文标题，返回英文标题
    if (this.language === 'en' && (def as any).titleEn) {
      return (def as any).titleEn;
    }

    // 否则返回中文标题（默认）
    return def.title;
  }

  /**
   * 翻译端口名称
   */
  translatePortName(nodeType: string, portName: string, isInput: boolean): string {
    const def = nodeRegistry.getNodeDefinition(nodeType);
    if (!def) return portName;

    const ports = isInput ? def.inputs : def.outputs;
    if (!ports) return portName;

    const port = ports.find(p => p.name === portName);
    if (!port) return portName;

    const legacy = legacyPortNameMap[port.name] || legacyPortNameMap[portName];
    const zhName = (port as any).nameZh || (port as any).label || legacy?.zh || port.name;
    const enName = (port as any).nameEn || legacy?.en || port.name;

    // 英文优先显示英文别名
    if (this.language === 'en') {
      return enName;
    }

    // 中文优先显示中文别名
    return zhName;
  }

  /**
   * 翻译分类名称
   */
  translateCategory(category: string): string {
    const categoryMap: Record<string, { zh: string; en: string }> = {
      '审计流程': { zh: '审计流程', en: 'Audit Process' },
      '审计分析': { zh: '审计分析', en: 'Audit Analysis' },
      '审计执行': { zh: '审计执行', en: 'Audit Execution' },
      '审计输出': { zh: '审计输出', en: 'Audit Output' },
      '后续管理': { zh: '后续管理', en: 'Follow-up Management' },
      '数据清洗': { zh: '数据清洗', en: 'Data Cleaning' },
      '数据可视化': { zh: '数据可视化', en: 'Data Visualization' },
      '数据验证': { zh: '数据验证', en: 'Data Validation' },
      '数据校验': { zh: '数据校验', en: 'Data Validation' },
      '数据源': { zh: '数据源', en: 'Data Source' },
      '数据输出': { zh: '数据输出', en: 'Data Output' },
      '票据处理': { zh: '票据处理', en: 'Invoice Processing' },
      '分析': { zh: '分析', en: 'Analysis' },
      '输出': { zh: '输出', en: 'Output' },
      '通用': { zh: '通用', en: 'General' },
  '未分类': { zh: '未分类', en: 'Uncategorized' },
  // 新增（左侧节点库中出现的英文分类）
      'AUDIT': { zh: '审计', en: 'Audit' },
      'Audit': { zh: '审计', en: 'Audit' },
      'VISUALIZATION': { zh: '可视化', en: 'Visualization' },
      'Visualization': { zh: '可视化', en: 'Visualization' },
      'VIZ': { zh: '可视化', en: 'Viz' },
      'Viz': { zh: '可视化', en: 'Viz' },
      'SCRIPT': { zh: '脚本', en: 'Script' },
      'Script': { zh: '脚本', en: 'Script' },
  'AI分析': { zh: 'AI分析', en: 'AI Analysis' },
  '协同': { zh: '协同', en: 'Collaboration' }
    };

    const mapping = categoryMap[category] || (CATEGORY_MAP_EXTRA as any)[category];
    if (!mapping) return category;

    return this.language === 'en' ? mapping.en : mapping.zh;
  }
}

// 导出单例
export const translator = new Translator();

// 补充分类映射（集中列出，便于维护）
export const CATEGORY_MAP_EXTRA: Record<string, { zh: string; en: string }> = {
  '审计流程': { zh: '审计流程', en: 'Audit Process' },
  '审计执行': { zh: '审计执行', en: 'Audit Execution' },
  '审计校验': { zh: '审计校验', en: 'Audit Validation' },
  '审计配置': { zh: '审计配置', en: 'Audit Configuration' },
  '审计输出': { zh: '审计输出', en: 'Audit Output' },
  '审计分析': { zh: '审计分析', en: 'Audit Analysis' },
  '数据校验': { zh: '数据校验', en: 'Data Validation' },
  '数据输出': { zh: '数据输出', en: 'Data Output' },
  '数据可视化': { zh: '数据可视化', en: 'Data Visualization' },
  '票据处理': { zh: '票据处理', en: 'Invoice Processing' },
  '票据分析': { zh: '票据分析', en: 'Invoice Analysis' },
  '高级功能': { zh: '高级功能', en: 'Advanced' }
};

