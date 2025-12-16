export interface WorkflowNodeDef {
  id: string;
  type: string;
  position: { x: number; y: number };
  params?: Record<string, any>;
  name?: string;
}

export interface WorkflowEdgeDef {
  from: string;
  to: string;
  from_slot?: number;
  to_slot?: number;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  data: {
    nodes: WorkflowNodeDef[];
    edges: WorkflowEdgeDef[];
  };
}

const CUSTOM_PRESETS_KEY = 'custom_workflow_presets';

// 审计常用预设工作流
export const workflowPresets: WorkflowPreset[] = [
  {
    id: 'excel_audit_basic',
    name: 'Excel审计基础流程',
    description: 'Excel加载 → 列名映射 → 空值清洗 → 列范围校验 → 数据预览/图表 + 文本AI + 报告',
    data: {
      nodes: [
        {
          id: 'excel_loader',
          type: 'ExcelLoader',
          position: { x: 80, y: 120 },
          params: {
            file_path: 'input/invoice_demo.xlsx',
            sheet_name: 'Sheet1',
            nrows: 5000,
          },
          name: '原始Excel加载',
        },
        {
          id: 'column_mapper',
          type: 'ColumnMapperNode',
          position: { x: 360, y: 120 },
          params: {
            mapping_json: '{"发票号码":"invoice_no","金额":"amount","日期":"date"}',
            keep_other_columns: true,
            strict_mode: false,
          },
          name: '列名映射',
        },
        {
          id: 'null_cleaner',
          type: 'NullValueCleanerNode',
          position: { x: 640, y: 120 },
          params: {
            strategy: 'drop_rows',
            target_columns: '*',
            report_limit: 50,
          },
          name: '空值清洗',
        },
        {
          id: 'range_validator',
          type: 'ExcelColumnValidator',
          position: { x: 920, y: 40 },
          params: {
            column_name: 'amount',
            min_value: 0,
            max_value: 200000,
            include_bounds: true,
            report_limit: 100,
          },
          name: '金额区间校验',
        },
        {
          id: 'preview_table',
          type: 'DataFrameToTableNode',
          position: { x: 920, y: 200 },
          params: {
            max_rows: 50,
            include_index: false,
          },
          name: '数据预览',
        },
        {
          id: 'quick_plot',
          type: 'QuickPlotNode',
          position: { x: 1200, y: 200 },
          params: {
            chart_type: 'bar',
            x_column: 'invoice_no',
            y_column: 'amount',
            title: '发票金额分布',
            legend_show: false,
          },
          name: '快速图表',
        },
        {
          id: 'text_ai',
          type: 'TextUnderstandingAI',
          position: { x: 1200, y: 40 },
          params: {
            text_data: '请根据前面对金额区间校验的异常结果，总结主要风险点，并给出文字说明。',
            task_type: 'summarize',
          },
          name: '文本理解AI（千问）',
        },
        {
          id: 'report_generation',
          type: 'ReportGeneration',
          position: { x: 1480, y: 40 },
          params: {},
          name: '审计报告生成',
        },
      ],
      edges: [
        // DataFrame 主链路
        { from: 'excel_loader', to: 'column_mapper', from_slot: 0, to_slot: 0 },
        { from: 'column_mapper', to: 'null_cleaner', from_slot: 0, to_slot: 0 },
        { from: 'null_cleaner', to: 'range_validator', from_slot: 0, to_slot: 0 },
        { from: 'null_cleaner', to: 'preview_table', from_slot: 0, to_slot: 0 },
        { from: 'null_cleaner', to: 'quick_plot', from_slot: 0, to_slot: 0 },
        // 文本AI链路：把校验报告传给文本AI，再把摘要传给报告生成
        { from: 'range_validator', to: 'text_ai', from_slot: 1, to_slot: 0 }, // report -> text_data
        { from: 'text_ai', to: 'report_generation', from_slot: 1, to_slot: 0 }, // key_sentences -> 违规事项记录
      ],
    },
  },
  {
    id: 'invoice_ocr_audit',
    name: '票据OCR审计流程',
    description: '文件上传 → 文档预处理 → OCR识别 → 结构化解析 → 规则加载 → 规则校验 → 人工复核 → 结果导出 → 审计归档',
    data: {
      nodes: [
        {
          id: 'file_upload',
          type: 'FileUpload',
          position: { x: 80, y: 120 },
          params: {
            file_path: 'input/invoice_demo.pdf',
            workflow_id: 'invoice_ocr_audit_v1',
          },
          name: '票据文件上传',
        },
        {
          id: 'preprocess_docs',
          type: 'PreprocessDocs',
          position: { x: 360, y: 120 },
          name: '文档预处理',
        },
        {
          id: 'ocr_node',
          type: 'OCR_TextRecognize',
          position: { x: 640, y: 120 },
          name: 'OCR文字识别',
        },
        {
          id: 'doc_parser',
          type: 'DocumentParser',
          position: { x: 920, y: 120 },
          name: '结构化解析',
        },
        {
          id: 'rule_loader',
          type: 'RuleSetLoader',
          position: { x: 920, y: 280 },
          params: {
            // 建议在界面中选择本地规则文件
          },
          name: '审计规则加载',
        },
        {
          id: 'validation',
          type: 'Validation',
          position: { x: 1200, y: 120 },
          params: {
            threshold: 0,
            strictMode: true,
          },
          name: '规则校验与审计',
        },
        {
          id: 'manual_review',
          type: 'ManualReview',
          position: { x: 1480, y: 120 },
          params: {
            reviewer: 'Auditor A',
          },
          name: '人工复核',
        },
        {
          id: 'text_ai_ocr',
          type: 'TextUnderstandingAI',
          position: { x: 1480, y: 20 },
          params: {
            text_data: '请对异常凭证生成摘要与复核要点。',
            task_type: 'summarize',
          },
          name: '文本AI摘要',
        },
        {
          id: 'export_results',
          type: 'ExportResults',
          position: { x: 1760, y: 120 },
          name: '结果导出',
        },
        {
          id: 'archive_audit',
          type: 'ArchiveAuditRecord',
          position: { x: 2040, y: 120 },
          name: '审计归档',
        },
      ],
      edges: [
        // 文件流与票据结构化链路
        { from: 'file_upload', to: 'preprocess_docs', from_slot: 0, to_slot: 0 },
        { from: 'preprocess_docs', to: 'ocr_node', from_slot: 0, to_slot: 0 },
        { from: 'ocr_node', to: 'doc_parser', from_slot: 0, to_slot: 0 },
        // 规则与校验
        { from: 'doc_parser', to: 'validation', from_slot: 0, to_slot: 0 },
        { from: 'rule_loader', to: 'validation', from_slot: 0, to_slot: 1 },
        // 人工复核链路
        { from: 'validation', to: 'manual_review', from_slot: 1, to_slot: 0 },
        { from: 'preprocess_docs', to: 'manual_review', from_slot: 0, to_slot: 1 },
        // 结果导出与归档链路
        { from: 'validation', to: 'export_results', from_slot: 0, to_slot: 0 },
        { from: 'validation', to: 'export_results', from_slot: 1, to_slot: 1 },
        { from: 'manual_review', to: 'export_results', from_slot: 0, to_slot: 2 },
        { from: 'export_results', to: 'archive_audit', from_slot: 0, to_slot: 0 },
        { from: 'manual_review', to: 'archive_audit', from_slot: 0, to_slot: 1 },
        // AI 摘要链路
        { from: 'validation', to: 'text_ai_ocr', from_slot: 1, to_slot: 0 },
        { from: 'text_ai_ocr', to: 'export_results', from_slot: 1, to_slot: 3 },
      ],
    },
  },
  {
    id: 'business_audit_flow',
    name: '业务审计全流程',
    description: '审计启动 → 数据采集 → 风险评估 → 合规性审查 → 实地盘点 → 报告生成 → 整改跟踪',
    data: {
      nodes: [
        {
          id: 'audit_start',
          type: 'AuditStart',
          position: { x: 80, y: 100 },
          params: {
            // 可在属性中上传审计通知书
          },
          name: '审计启动',
        },
        {
          id: 'data_collection',
          type: 'DataCollection',
          position: { x: 360, y: 100 },
          name: '数据采集',
        },
        {
          id: 'risk_assessment',
          type: 'AuditRiskAssessment',
          position: { x: 640, y: 100 },
          name: '风险评估',
        },
        {
          id: 'compliance_check',
          type: 'ComplianceCheck',
          position: { x: 920, y: 60 },
          name: '合规性审查',
        },
        {
          id: 'field_check',
          type: 'FieldCheck',
          position: { x: 920, y: 180 },
          name: '实地盘点',
        },
        {
          id: 'report_generation_biz',
          type: 'ReportGeneration',
          position: { x: 1200, y: 100 },
          name: '报告生成',
        },
        {
          id: 'rectification_track',
          type: 'RectificationTrack',
          position: { x: 1480, y: 100 },
          name: '整改跟踪',
        },
        {
          id: 'text_ai_summary',
          type: 'TextUnderstandingAI',
          position: { x: 1200, y: 260 },
          params: {
            text_data: '请根据本次业务审计的高风险领域和合规性审查结果，总结本次审计的关键发现和整改建议。',
            task_type: 'summarize',
          },
          name: '文本理解AI（业务总结）',
        },
      ],
      edges: [
        { from: 'audit_start', to: 'data_collection', from_slot: 1, to_slot: 0 }, // 资料需求清单
        { from: 'data_collection', to: 'risk_assessment', from_slot: 0, to_slot: 0 }, // 财务数据
        { from: 'data_collection', to: 'risk_assessment', from_slot: 1, to_slot: 1 }, // 工程档案
        { from: 'risk_assessment', to: 'compliance_check', from_slot: 1, to_slot: 1 }, // 重点审计对象
        { from: 'data_collection', to: 'compliance_check', from_slot: 2, to_slot: 0 }, // 合同文件
        { from: 'risk_assessment', to: 'field_check', from_slot: 0, to_slot: 1 }, // 高风险领域清单
        { from: 'field_check', to: 'report_generation_biz', from_slot: 0, to_slot: 1 }, // 盘点差异报告
        { from: 'compliance_check', to: 'report_generation_biz', from_slot: 0, to_slot: 0 }, // 违规事项记录
        { from: 'report_generation_biz', to: 'rectification_track', from_slot: 1, to_slot: 0 }, // 整改建议书
        // 文本理解 AI：输入违规记录，输出摘要给报告生成（作为线索/说明）
        { from: 'compliance_check', to: 'text_ai_summary', from_slot: 0, to_slot: 0 }, // 违规事项记录 -> 文本数据
        { from: 'text_ai_summary', to: 'report_generation_biz', from_slot: 1, to_slot: 2 }, // 关键句 -> 利益输送线索
      ],
    },
  },
  // ===== 新增预设工作流 =====
  {
    id: 'payment_risk_text_ai',
    name: '付款舞弊快速体检',
    description: '付款数据映射/清洗 → 金额区间校验 → AI 风险摘要 → 报告生成（供应商/大额付款场景）',
    data: {
      nodes: [
        {
          id: 'excel_loader_pay',
          type: 'ExcelLoader',
          position: { x: 80, y: 160 },
          params: { file_path: 'input/payments.xlsx', sheet_name: 'Sheet1' },
          name: '付款数据加载'
        },
        {
          id: 'mapper_pay',
          type: 'ColumnMapperNode',
          position: { x: 320, y: 160 },
          params: { mapping_json: '{"金额":"amount","业务类型":"biz_type","收款方":"vendor"}', keep_other_columns: true, strict_mode: false },
          name: '列名映射'
        },
        {
          id: 'cleaner_pay',
          type: 'NullValueCleanerNode',
          position: { x: 560, y: 160 },
          params: { strategy: 'drop_rows', target_columns: '*', report_limit: 100 },
          name: '空值清洗'
        },
        {
          id: 'validator_pay',
          type: 'ExcelColumnValidator',
          position: { x: 800, y: 100 },
          params: { column_name: 'amount', min_value: 0, max_value: 200000, report_limit: 50 },
          name: '金额区间校验'
        },
        {
          id: 'text_ai_pay',
          type: 'TextUnderstandingAI',
          position: { x: 1040, y: 100 },
          params: { text_data: '请根据校验报告，提炼主要风险点和异常摘要。', task_type: 'summarize' },
          name: '文本理解AI'
        },
        {
          id: 'report_pay',
          type: 'ReportGeneration',
          position: { x: 1280, y: 120 },
          params: {},
          name: '报告生成'
        }
      ],
      edges: [
        { from: 'excel_loader_pay', to: 'mapper_pay', from_slot: 0, to_slot: 0 },
        { from: 'mapper_pay', to: 'cleaner_pay', from_slot: 0, to_slot: 0 },
        { from: 'cleaner_pay', to: 'validator_pay', from_slot: 0, to_slot: 0 },
        { from: 'validator_pay', to: 'text_ai_pay', from_slot: 1, to_slot: 0 }, // 报告 -> 文本数据
        { from: 'text_ai_pay', to: 'report_pay', from_slot: 1, to_slot: 2 } // 关键句 -> 利益输送线索
      ]
    }
  },
  {
    id: 'inventory_check_flow',
    name: '库存盘点与整改',
    description: '数据采集 → 风险评估 → 合规审查 → 实地盘点 → 报告生成 → 整改跟踪',
    data: {
      nodes: [
        { id: 'audit_start_inv', type: 'AuditStart', position: { x: 80, y: 100 }, name: '审计启动' },
        { id: 'data_collection_inv', type: 'DataCollection', position: { x: 320, y: 100 }, name: '数据采集' },
        { id: 'risk_inv', type: 'AuditRiskAssessment', position: { x: 560, y: 100 }, name: '风险评估' },
        { id: 'compliance_inv', type: 'ComplianceCheck', position: { x: 800, y: 60 }, name: '合规性审查' },
        { id: 'field_inv', type: 'FieldCheck', position: { x: 800, y: 200 }, name: '实地盘点' },
        { id: 'text_ai_inv', type: 'TextUnderstandingAI', position: { x: 1040, y: 60 }, params: { task_type: 'summarize' }, name: '文本理解AI' },
        { id: 'report_inv', type: 'ReportGeneration', position: { x: 1280, y: 100 }, name: '报告生成' },
        { id: 'rectify_inv', type: 'RectificationTrack', position: { x: 1520, y: 120 }, name: '整改跟踪' }
      ],
      edges: [
        { from: 'audit_start_inv', to: 'data_collection_inv', from_slot: 0, to_slot: 0 },
        { from: 'data_collection_inv', to: 'risk_inv', from_slot: 0, to_slot: 0 },
        { from: 'risk_inv', to: 'compliance_inv', from_slot: 1, to_slot: 1 }, // 重点审计对象
        { from: 'data_collection_inv', to: 'compliance_inv', from_slot: 2, to_slot: 0 }, // 合同文件
        { from: 'risk_inv', to: 'field_inv', from_slot: 0, to_slot: 1 }, // 高风险领域清单
        { from: 'field_inv', to: 'report_inv', from_slot: 0, to_slot: 1 }, // 盘点差异报告
        { from: 'compliance_inv', to: 'report_inv', from_slot: 0, to_slot: 0 }, // 违规事项记录
        { from: 'compliance_inv', to: 'text_ai_inv', from_slot: 0, to_slot: 0 }, // 违规事项记录 -> 文本AI
        { from: 'text_ai_inv', to: 'report_inv', from_slot: 1, to_slot: 2 }, // 关键句 -> 利益输送线索
        { from: 'report_inv', to: 'rectify_inv', from_slot: 1, to_slot: 0 } // 整改建议书
      ]
    }
  },
  // invoice_ocr_light 已移除，避免与 OCR 流程重合
  {
    id: 'invoice_review_strict',
    name: '票据OCR+双AI严格复核',
    description: '上传→预处理→OCR→解析→规则→严格校验→AI预复核摘要→人工复核→AI终态摘要→导出→归档',
    data: {
      nodes: [
        { id: 'file_upload_strict', type: 'FileUpload', position: { x: 80, y: 220 }, name: '文件上传' },
        { id: 'preprocess_strict', type: 'PreprocessDocs', position: { x: 320, y: 220 }, name: '文档预处理' },
        { id: 'ocr_strict', type: 'OCR_TextRecognize', position: { x: 560, y: 220 }, name: 'OCR识别' },
        { id: 'parser_strict', type: 'DocumentParser', position: { x: 800, y: 220 }, name: '结构化解析' },
        { id: 'rules_strict', type: 'RuleSetLoader', position: { x: 1040, y: 200 }, name: '规则加载' },
        { id: 'validation_strict', type: 'Validation', position: { x: 1280, y: 220 }, params: { threshold: 0.1, strictMode: true }, name: '规则校验' },
        { id: 'text_ai_strict_pre', type: 'TextUnderstandingAI', position: { x: 1520, y: 140 }, params: { task_type: 'summarize', text_data: '请对异常凭证生成复核要点摘要。' }, name: 'AI预复核摘要' },
        { id: 'manual_review_strict', type: 'ManualReview', position: { x: 1520, y: 220 }, name: '人工复核' },
        { id: 'text_ai_strict_final', type: 'TextUnderstandingAI', position: { x: 1760, y: 140 }, params: { task_type: 'summarize', text_data: '请汇总复核后的要点与结论，生成终态摘要。' }, name: 'AI终态摘要' },
        { id: 'export_strict', type: 'ExportResults', position: { x: 1980, y: 220 }, name: '结果导出' },
        { id: 'archive_strict', type: 'ArchiveAuditRecord', position: { x: 2220, y: 220 }, name: '审计归档' }
      ],
      edges: [
        { from: 'file_upload_strict', to: 'preprocess_strict', from_slot: 0, to_slot: 0 },
        { from: 'preprocess_strict', to: 'ocr_strict', from_slot: 0, to_slot: 0 },
        { from: 'ocr_strict', to: 'parser_strict', from_slot: 0, to_slot: 0 },
        { from: 'parser_strict', to: 'validation_strict', from_slot: 0, to_slot: 0 },
        { from: 'rules_strict', to: 'validation_strict', from_slot: 0, to_slot: 1 },
        // 异常 -> AI预复核摘要 -> 人工复核
        { from: 'validation_strict', to: 'text_ai_strict_pre', from_slot: 1, to_slot: 0 },
        { from: 'text_ai_strict_pre', to: 'manual_review_strict', from_slot: 1, to_slot: 0 },
        { from: 'validation_strict', to: 'manual_review_strict', from_slot: 1, to_slot: 1 },
        // 合规/异常直达导出
        { from: 'validation_strict', to: 'export_strict', from_slot: 0, to_slot: 0 },
        { from: 'validation_strict', to: 'export_strict', from_slot: 1, to_slot: 1 },
        { from: 'manual_review_strict', to: 'export_strict', from_slot: 0, to_slot: 2 },
        // 复核后再做终态摘要，写回导出备注
        { from: 'manual_review_strict', to: 'text_ai_strict_final', from_slot: 0, to_slot: 0 },
        { from: 'text_ai_strict_final', to: 'export_strict', from_slot: 1, to_slot: 3 },
        // 归档
        { from: 'export_strict', to: 'archive_strict', from_slot: 0, to_slot: 0 },
        { from: 'manual_review_strict', to: 'archive_strict', from_slot: 0, to_slot: 1 }
      ]
    }
  },
  {
    id: 'contract_compliance_loop',
    name: '合同合规与复核闭环',
    description: '审计启动 → 数据采集 → 合同合规审查 → AI摘要 → 报告生成 → 整改跟踪（招采/合同合规专用）',
    data: {
      nodes: [
        { id: 'audit_start_cc', type: 'AuditStart', position: { x: 80, y: 100 }, name: '审计启动' },
        { id: 'data_collection_cc', type: 'DataCollection', position: { x: 320, y: 100 }, name: '数据采集' },
        { id: 'compliance_cc', type: 'ComplianceCheck', position: { x: 560, y: 80 }, name: '合同合规审查' },
        { id: 'text_ai_cc', type: 'TextUnderstandingAI', position: { x: 800, y: 60 }, params: { task_type: 'summarize', text_data: '请对合规审查的违规事项生成整改摘要与建议。' }, name: '合规摘要AI' },
        { id: 'report_cc', type: 'ReportGeneration', position: { x: 1040, y: 100 }, name: '报告生成' },
        { id: 'rectify_cc', type: 'RectificationTrack', position: { x: 1280, y: 120 }, name: '整改跟踪' }
      ],
      edges: [
        { from: 'audit_start_cc', to: 'data_collection_cc', from_slot: 0, to_slot: 0 },
        { from: 'data_collection_cc', to: 'compliance_cc', from_slot: 2, to_slot: 0 }, // 合同文件
        { from: 'data_collection_cc', to: 'compliance_cc', from_slot: 1, to_slot: 1 }, // 重点对象/资料
        { from: 'compliance_cc', to: 'text_ai_cc', from_slot: 0, to_slot: 0 }, // 违规事项 -> AI
        { from: 'text_ai_cc', to: 'report_cc', from_slot: 1, to_slot: 0 }, // 关键句 -> 报告
        { from: 'compliance_cc', to: 'report_cc', from_slot: 0, to_slot: 1 }, // 违规事项 -> 报告输入
        { from: 'report_cc', to: 'rectify_cc', from_slot: 1, to_slot: 0 } // 整改建议书 -> 跟踪
      ]
    }
  }
];

export function getPresetById(id: string): WorkflowPreset | undefined {
  return getAllPresets().find((p) => p.id === id);
}

export function getAllPresets(): WorkflowPreset[] {
  return [...workflowPresets, ...loadCustomPresets()];
}

export function loadCustomPresets(): WorkflowPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveCustomPreset(preset: WorkflowPreset) {
  const current = loadCustomPresets();
  const filtered = current.filter(p => p.id !== preset.id);
  filtered.push(preset);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(filtered));
}


