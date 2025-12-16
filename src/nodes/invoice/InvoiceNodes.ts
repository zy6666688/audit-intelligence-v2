import { BaseNode } from '@/nodes/BaseNode';
import { nodeRegistry } from '@/core/registry/NodeRegistry';

// 1. FileUpload 节点
export class FileUploadNode extends BaseNode {
  constructor() {
    super('FileUpload');
    // FileUpload 节点稍微大一点，方便展示
    this.size = { width: 180, height: 100 };
    this.autoResize = false; // 禁止自动调整大小，保持自定义尺寸
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { width, height } = this.size;
    const titleHeight = 32;
    const contentY = titleHeight + 10;
    
    // 绘制上传区域背景 (虚线框)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(10, contentY, width - 20, height - contentY - 10);
    ctx.setLineDash([]); // 恢复实线

    // 获取文件名
    const file = this.data['file'];
    let fileName = 'No file selected';
    if (file instanceof File) {
      fileName = file.name;
    } else if (typeof file === 'string') {
      fileName = file;
    }

    // 绘制图标 (简易云上传图标)
    ctx.fillStyle = '#888';
    ctx.beginPath();
    const cx = width / 2;
    const cy = contentY + 20;
    // Arrow
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx - 6, cy + 5);
    ctx.lineTo(cx - 2, cy + 5);
    ctx.lineTo(cx - 2, cy + 12);
    ctx.lineTo(cx + 2, cy + 12);
    ctx.lineTo(cx + 2, cy + 5);
    ctx.lineTo(cx + 6, cy + 5);
    ctx.closePath();
    ctx.fill();

    // 绘制文字
    ctx.font = '11px Arial';
    ctx.fillStyle = file ? '#ccc' : '#666';
    ctx.textAlign = 'center';
    
    // 简单的文字截断
    const maxWidth = width - 30;
    let displayText = fileName;
    if (ctx.measureText(displayText).width > maxWidth) {
      while (ctx.measureText(displayText + '...').width > maxWidth && displayText.length > 0) {
        displayText = displayText.slice(0, -1);
      }
      displayText += '...';
    }
    
    ctx.fillText(displayText, width / 2, contentY + 40);
  }
}
nodeRegistry.registerNode({
  type: 'FileUpload',
  title: '文件上传',
  category: '票据处理',
  inputs: [],
  outputs: [
    { name: 'raw_files', nameZh: '原始文件', type: 'Blob[]' }
  ],
  properties: [
    { 
      name: 'file', 
      label: '选择文件', 
      type: 'file', 
      placeholder: '请选择票据文件',
      description: '上传Excel、PDF或图片文件进行审计处理'
    },
    {
      name: 'file_path',
      label: '文件路径',
      type: 'string',
      placeholder: 'input/invoice_demo.xlsx',
      description: '文件存储路径（可选，上传后自动生成）'
    },
    {
      name: 'workflow_id',
      label: '工作流ID',
      type: 'string',
      placeholder: 'audit_demo_mock_v1',
      description: '关联的工作流ID，用于文件管理'
    }
  ],
  description: '上传原始审计文件（Excel、PDF、图片等）。支持拖拽上传，文件会自动存储并生成元数据。'
});

// FileUploadNode 是 FileUpload 的别名
// 严格按照后端RETURN_TYPES和RETURN_NAMES定义
nodeRegistry.registerNode({
  type: 'FileUploadNode',
  title: '文件上传',
  category: '票据处理',
  // 严格按照后端INPUT_TYPES定义：required在前，optional在后
  inputs: [
    { name: 'file_path', nameZh: '文件路径', type: 'STRING' },  // Slot 0 (required)
    { name: 'workflow_id', nameZh: '工作流ID', type: 'STRING' },  // Slot 1 (required)
    { name: 'file_type_hint', nameZh: '文件类型提示', type: 'STRING' }  // Slot 2 (optional)
  ],
  outputs: [
    { name: 'file_id', nameZh: '文件ID', type: 'STRING' },  // Slot 0
    { name: 'storage_path', nameZh: '存储路径', type: 'STRING' },  // Slot 1
    { name: 'file_metadata', nameZh: '文件元数据', type: 'DICT' }  // Slot 2
  ],
  properties: [
    { 
      name: 'file', 
      label: '选择文件', 
      type: 'file', 
      placeholder: '请选择票据文件',
      description: '上传Excel、PDF或图片文件进行审计处理'
    },
    {
      name: 'file_path',
      label: '文件路径',
      type: 'string',
      placeholder: 'input/invoice_demo.xlsx',
      description: '文件存储路径（可选，上传后自动生成）'
    },
    {
      name: 'workflow_id',
      label: '工作流ID',
      type: 'string',
      placeholder: 'audit_demo_mock_v1',
      description: '关联的工作流ID，用于文件管理'
    }
  ],
  description: '上传原始审计文件（Excel、PDF、图片等）。支持拖拽上传，文件会自动存储并生成元数据。'
});

// 2. PreprocessDocs 节点
export class PreprocessDocsNode extends BaseNode {
  constructor() {
    super('PreprocessDocs');
  }
}
nodeRegistry.registerNode({
  type: 'PreprocessDocs',
  title: '文档预处理',
  category: '票据处理',
  inputs: [
    { name: 'raw_files', nameZh: '原始文件', type: 'Blob[]' }
  ],
  outputs: [
    { name: 'preprocessed_docs', nameZh: '预处理文档', type: 'Document[]' }
  ]
});

// 3. OCR_TextRecognize 节点
export class OCRNode extends BaseNode {
  constructor() {
    super('OCR_TextRecognize');
  }
}
nodeRegistry.registerNode({
  type: 'OCR_TextRecognize',
  title: 'OCR 文字识别',
  category: '票据处理',
  inputs: [
    { name: 'preprocessed_docs', nameZh: '预处理文档', type: 'Document[]' }
  ],
  outputs: [
    { name: 'ocr_results', nameZh: 'OCR结果', type: 'OCRResult[]' }
  ]
});

// 4. DocumentParser 节点
export class DocumentParserNode extends BaseNode {
  constructor() {
    super('DocumentParser');
  }
}
nodeRegistry.registerNode({
  type: 'DocumentParser',
  title: '结构化解析',
  category: '票据分析',
  inputs: [
    { name: 'ocr_results', nameZh: 'OCR结果', type: 'OCRResult[]' },
    { name: 'preprocessed_docs', nameZh: '预处理文档', type: 'Document[]' } // 兼容电子文档
  ],
  outputs: [
    { name: 'structured_vouchers', nameZh: '结构化凭证', type: 'Voucher[]' }
  ]
});

// 5. RuleSetLoader 节点 (新增)
export class RuleSetLoaderNode extends BaseNode {
  constructor() {
    super('RuleSetLoader');
  }
}
nodeRegistry.registerNode({
  type: 'RuleSetLoader',
  title: '审计规则加载',
  category: '审计配置',
  inputs: [], // 可以是配置输入
  outputs: [
    { name: 'rule_set', nameZh: '规则集', type: 'Rule[]' }
  ],
  properties: [
    { name: 'rulesFile', label: '规则文件 (.json)', type: 'file', placeholder: '选择规则文件' }
  ]
});

// 6. Validation & AuditRuleCheck 节点
export class ValidationNode extends BaseNode {
  constructor() {
    super('Validation');
  }
}
nodeRegistry.registerNode({
  type: 'Validation',
  title: '规则校验与审计',
  category: '审计校验',
  inputs: [
    { name: 'structured_vouchers', nameZh: '结构化凭证', type: 'Voucher[]' },
    { name: 'rule_set', nameZh: '规则集', type: 'Rule[]' }
  ],
  outputs: [
    { name: 'valid_vouchers', nameZh: '合规凭证', type: 'Voucher[]' },
    { name: 'invalid_vouchers', nameZh: '异常凭证', type: 'Voucher[]' }
  ],
  properties: [
    { name: 'threshold', label: '容错阈值', type: 'number', defaultValue: 0 },
    { name: 'strictMode', label: '严格模式', type: 'boolean', defaultValue: true }
  ]
});

// 7. ManualReview 节点
export class ManualReviewNode extends BaseNode {
  constructor() {
    super('ManualReview');
  }
}
nodeRegistry.registerNode({
  type: 'ManualReview',
  title: '人工复核',
  category: '审计校验',
  inputs: [
    { name: 'invalid_vouchers', nameZh: '异常凭证', type: 'Voucher[]' },
    { name: 'preprocessed_docs', nameZh: '预处理文档', type: 'Document[]' } // 可选原始文档辅助
  ],
  outputs: [
    { name: 'reviewed_vouchers', nameZh: '复核凭证', type: 'Voucher[]' }
  ],
  properties: [
    { name: 'reviewer', label: '复核人员', type: 'select', options: ['Auditor A', 'Auditor B', 'Manager'], defaultValue: 'Auditor A' }
  ]
});

// 8. ExportResults 节点
export class ExportNode extends BaseNode {
  constructor() {
    super('ExportResults');
  }
}
nodeRegistry.registerNode({
  type: 'ExportResults',
  title: '结果导出',
  category: '审计输出',
  inputs: [
    { name: 'valid_vouchers', nameZh: '合规凭证', type: 'Voucher[]' },
    { name: 'invalid_vouchers', nameZh: '异常凭证', type: 'Voucher[]' },
    { name: 'reviewed_vouchers', nameZh: '复核凭证', type: 'Voucher[]' }
  ],
  outputs: [
    { name: 'exported_files', nameZh: '导出文件', type: 'File[]' }
  ]
});

// 9. ArchiveAuditRecord 节点
export class ArchiveNode extends BaseNode {
  constructor() {
    super('ArchiveAuditRecord');
  }
}
nodeRegistry.registerNode({
  type: 'ArchiveAuditRecord',
  title: '审计归档',
  category: '审计输出',
  inputs: [
    { name: 'exported_files', nameZh: '导出文件', type: 'File[]' },
    { name: 'reviewed_vouchers', nameZh: '复核凭证', type: 'Voucher[]' }
  ],
  outputs: [
    { name: 'archive_record', nameZh: '归档记录', type: 'Record' }
  ]
});
