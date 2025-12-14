/**
 * 国际化语言系统
 */

export type Language = 'zh' | 'en';

let currentLanguage: Language = 'zh';

// 语言包定义
const messages = {
  zh: {
    // 工具栏
    toolbar: {
      addNode: '+ 添加节点',
      autoLayout: '🔄 自动布局',
      aiAnalyze: '🤖 AI分析',
      run: '▶ 运行',
      history: '📜 历史版本',
      save: '💾 保存',
      langSwitch: '🌐 中文'
    },
    
    // 节点分类
    categories: {
      input: '输入节点',
      audit: '审计节点',
      special: '专项审计',
      analysis: '分析节点',
      output: '输出节点'
    },
    
    // 端口类型
    ports: {
      voucher: '凭证',
      ledger: '账簿',
      flow: '流水',
      contract: '合同',
      image: '图片',
      report: '报告',
      risk: '风险',
      graph: '图谱',
      array: '数组',
      any: '任意',
      string: '字符串',
      number: '数字',
      boolean: '布尔值',
      file: '文件',
      files: '文件列表',
      data: '数据',
      risks: '风险列表',
      evidence: '证据',
      onlyData: '账单数据',
      payFlow: '支付流水',
      saleContract: '销售合同',
      escrowFlow: '监管流水',
      misuseRisk: '挪用风险',
      bankFlow: '银行流水',
      loopGraph: '回流图谱',
      opinion: '意见'
    },
    
    // 通用文本
    common: {
      confirm: '确定',
      cancel: '取消',
      loading: '加载中...',
      success: '成功',
      error: '错误',
      warning: '警告',
      delete: '删除',
      edit: '编辑',
      close: '关闭'
    },
    
    // 提示消息
    messages: {
      saveSuccess: '保存成功',
      saveFailed: '保存失败',
      deleteSuccess: '删除成功',
      deleteFailed: '删除失败',
      executeSuccess: '✅ 工作流执行成功',
      executeFailed: '⚠️ 执行错误',
      executingWorkflow: '正在执行工作流...',
      aiAnalyzing: 'AI分析中...',
      aiAnalyzeSuccess: 'AI分析完成',
      aiAnalyzeFailed: 'AI分析失败，请稍后重试',
      autoLayoutSuccess: '自动布局完成',
      autoLayoutFailed: '自动布局失败',
      portTypeMismatch: '端口类型不匹配',
      langSwitched: '✅ 已切换至中文',
      executeSummary: (count: number) => `执行完成！\n\n处理节点数: ${count}\n\n点击节点查看详细结果`,
      executionError: '工作流执行失败，请检查节点连接和配置',
      unsavedChanges: '⚠️ 有未保存的更改',
      unsavedNodesPrompt: (nodes: string[]) => `以下节点已修改但未保存：\n\n${nodes.join('\n')}\n\n是否现在保存？`,
      saveNow: '立即保存',
      saveLater: '稍后保存',
      unsavedCount: (count: number) => `有 ${count} 个节点未保存`,
      saveSuccessful: '✅ 保存成功',
      loadFailed: '加载失败'
    },
    
    // 属性面板
    properties: {
      title: '属性',
      basicInfo: '基本信息',
      nodeTitle: '节点标题',
      nodeType: '节点类型',
      nodeDesc: '节点描述',
      nodeContent: '节点内容',
      aiAnalysisResult: 'AI分析结果',
      riskLevel: '风险等级',
      advancedEdit: '✏️ 高级编辑',
      aiAnalyze: '🤖 AI分析',
      deleteNode: '🗑️ 删除节点',
      selectNodeHint: '选择节点查看属性',
      enterTitle: '输入标题',
      enterContent: '输入节点内容...'
    },
    
    // 缩放控制
    zoom: {
      in: '+',
      out: '-',
      reset: '⊙'
    }
  },
  
  en: {
    // Toolbar
    toolbar: {
      addNode: '+ Add Node',
      autoLayout: '🔄 Auto Layout',
      aiAnalyze: '🤖 AI Analyze',
      run: '▶ Run',
      history: '📜 History',
      save: '💾 Save',
      langSwitch: '🌐 EN'
    },
    
    // Node Categories
    categories: {
      input: 'Input Nodes',
      audit: 'Audit Nodes',
      special: 'Special Audit',
      analysis: 'Analysis Nodes',
      output: 'Output Nodes'
    },
    
    // Port Types
    ports: {
      voucher: 'Voucher',
      ledger: 'Ledger',
      flow: 'Flow',
      contract: 'Contract',
      image: 'Image',
      report: 'Report',
      risk: 'Risk',
      graph: 'Graph',
      array: 'Array',
      any: 'Any',
      string: 'String',
      number: 'Number',
      boolean: 'Boolean',
      file: 'File',
      files: 'Files',
      data: 'Data',
      risks: 'Risks',
      evidence: 'Evidence',
      onlyData: 'Order Data',
      payFlow: 'Pay Flow',
      saleContract: 'Sales Contract',
      escrowFlow: 'Escrow Flow',
      misuseRisk: 'Misuse Risk',
      bankFlow: 'Bank Flow',
      loopGraph: 'Loop Graph',
      opinion: 'Opinion'
    },
    
    // Common Text
    common: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close'
    },
    
    // Messages
    messages: {
      saveSuccess: 'Saved successfully',
      saveFailed: 'Save failed',
      deleteSuccess: 'Deleted successfully',
      deleteFailed: 'Delete failed',
      executeSuccess: '✅ Workflow executed successfully',
      executeFailed: '⚠️ Execution error',
      executingWorkflow: 'Executing workflow...',
      aiAnalyzing: 'AI analyzing...',
      aiAnalyzeSuccess: 'AI analysis completed',
      aiAnalyzeFailed: 'AI analysis failed, please try again later',
      autoLayoutSuccess: 'Auto layout completed',
      autoLayoutFailed: 'Auto layout failed',
      portTypeMismatch: 'Port type mismatch',
      langSwitched: '✅ Switched to English',
      executeSummary: (count: number) => `Execution completed!\n\nProcessed nodes: ${count}\n\nClick nodes to view results`,
      executionError: 'Workflow execution failed, please check node connections and configuration',
      unsavedChanges: '⚠️ Unsaved Changes',
      unsavedNodesPrompt: (nodes: string[]) => `The following nodes have been modified but not saved:\n\n${nodes.join('\n')}\n\nSave now?`,
      saveNow: 'Save Now',
      saveLater: 'Save Later',
      unsavedCount: (count: number) => `${count} node(s) unsaved`,
      saveSuccessful: '✅ Saved successfully',
      loadFailed: 'Load failed'
    },
    
    // Properties Panel
    properties: {
      title: 'Properties',
      basicInfo: 'Basic Info',
      nodeTitle: 'Node Title',
      nodeType: 'Node Type',
      nodeDesc: 'Description',
      nodeContent: 'Content',
      aiAnalysisResult: 'AI Analysis Result',
      riskLevel: 'Risk Level',
      advancedEdit: '✏️ Advanced Edit',
      aiAnalyze: '🤖 AI Analyze',
      deleteNode: '🗑️ Delete Node',
      selectNodeHint: 'Select a node to view properties',
      enterTitle: 'Enter title',
      enterContent: 'Enter content...'
    },
    
    // Zoom Controls
    zoom: {
      in: '+',
      out: '-',
      reset: '⊙'
    }
  }
};

// 获取当前语言
export const getLanguage = (): Language => currentLanguage;

// 设置语言
export const setLanguage = (lang: Language) => {
  currentLanguage = lang;
};

// 获取翻译文本
export const t = (key: string, ...args: any[]): string => {
  const keys = key.split('.');
  let value: any = messages[currentLanguage];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      return key;
    }
  }
  
  if (typeof value === 'function') {
    return value(...args);
  }
  
  return value || key;
};

// 导出语言包供直接访问
export const getMessages = () => messages[currentLanguage];
