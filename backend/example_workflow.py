"""
发票审计工作流示例
一个完整的端到端审计工作流，展示所有节点的协同工作
"""

import json
import pandas as pd
import os
from datetime import datetime

# 创建示例数据
def create_sample_invoice_data():
    """创建示例发票数据用于测试"""
    
    # 创建示例发票数据
    data = {
        'invoice_number': ['INV-2024-001', 'INV-2024-002', 'INV-2024-003', 'INV-2024-004', 'INV-2024-001'],  # 有重复
        'vendor': ['供应商A', '供应商B', '供应商A', '供应商C', '供应商A'],
        'amount': [10000.00, 25000.00, 150000.00, 5000.00, 10000.00],  # 有异常金额
        'date': ['2024-01-15', '2024-01-20', '2024-02-01', '2024-02-15', '2024-01-15'],
        'category': ['办公用品', '咨询服务', '设备采购', '差旅费用', '办公用品'],
        'employee_id': ['EMP001', 'EMP002', 'EMP001', 'EMP003', 'EMP001'],
        'description': ['采购办公用品', '技术咨询服务', '采购服务器设备-金额异常大', '员工差旅报销', '重复的办公用品采购']
    }
    
    df = pd.DataFrame(data)
    
    # 保存为Excel文件
    os.makedirs('backend/input', exist_ok=True)
    file_path = 'backend/input/sample_invoices.xlsx'
    df.to_excel(file_path, index=False)
    print(f"✅ 示例数据已创建: {file_path}")
    
    return file_path


def build_invoice_audit_workflow():
    """
    构建完整的发票审计工作流
    展示节点如何串联工作
    """
    
    workflow = {
        "workflow_id": "invoice_audit_demo_v1",
        "name": "发票审计示例工作流",
        "description": "端到端的发票审计流程，包含数据加载、清洗、指标计算、规则检查、AI分析和报告生成",
        "created_at": datetime.now().isoformat(),
        
        # 定义节点
        "nodes": [
            # Layer 1: 数据采集
            {
                "id": "n1",
                "type": "ExcelLoader",
                "name": "加载发票数据",
                "params": {
                    "file_path": "input/sample_invoices.xlsx"
                },
                "position": {"x": 100, "y": 200}
            },
            
            # Layer 1.5: 数据清洗
            {
                "id": "n2", 
                "type": "ColumnMapperNode",
                "name": "标准化列名",
                "params": {
                    "mapping_json": json.dumps({
                        "invoice_number": "发票号",
                        "vendor": "供应商",
                        "amount": "金额",
                        "date": "日期",
                        "category": "类别"
                    }),
                    "keep_other_columns": True,
                    "strict_mode": False
                },
                "position": {"x": 300, "y": 200}
            },
            
            {
                "id": "n3",
                "type": "NullValueCleanerNode", 
                "name": "清理空值",
                "params": {
                    "target_columns": "*",
                    "strategy": "drop_rows"
                },
                "position": {"x": 500, "y": 200}
            },
            
            # Layer 2: 指标计算
            {
                "id": "n4",
                "type": "CommonMetricsNode",
                "name": "计算基础指标",
                "params": {},
                "position": {"x": 700, "y": 100}
            },
            
            {
                "id": "n5",
                "type": "SceneMetricsNode",
                "name": "计算发票场景指标",
                "params": {
                    "business_scene": "invoice_audit"
                },
                "position": {"x": 900, "y": 100}
            },
            
            # Layer 2: 规则计算
            {
                "id": "n6",
                "type": "RuleCalculationNode",
                "name": "执行审计规则",
                "params": {},
                "position": {"x": 1100, "y": 200}
            },
            
            # Layer 2: 基础审计
            {
                "id": "n7",
                "type": "ExcelColumnValidator",
                "name": "金额范围验证",
                "params": {
                    "column_name": "金额",
                    "min_value": 0,
                    "max_value": 100000
                },
                "position": {"x": 700, "y": 300}
            },
            
            # Layer 3: AI分析
            {
                "id": "n8",
                "type": "TextUnderstandingAI",
                "name": "分析描述文本",
                "params": {
                    "task_type": "extract"
                },
                "position": {"x": 1300, "y": 100}
            },
            
            {
                "id": "n9",
                "type": "AnalysisReasoningAI",
                "name": "综合风险分析",
                "params": {},
                "position": {"x": 1500, "y": 200}
            },
            
            # Layer 4: 人工审核
            {
                "id": "n10",
                "type": "HumanReviewNode",
                "name": "人工复核",
                "params": {
                    "reviewer_comment": "经审核确认"
                },
                "position": {"x": 1700, "y": 200}
            },
            
            # Layer 5: 可视化
            {
                "id": "n11",
                "type": "QuickPlotNode",
                "name": "生成供应商分析图",
                "params": {
                    "chart_type": "pie",
                    "x_column": "供应商",
                    "y_column": "金额",
                    "title": "供应商金额分布"
                },
                "position": {"x": 900, "y": 400}
            },
            
            {
                "id": "n12",
                "type": "DataFrameToTableNode",
                "name": "异常数据预览",
                "params": {
                    "max_rows": 20,
                    "include_index": False
                },
                "position": {"x": 1100, "y": 400}
            },
            
            # Layer 5: 报告生成
            {
                "id": "n13",
                "type": "ResultGenerationNode",
                "name": "生成审计结果",
                "params": {},
                "position": {"x": 1900, "y": 200}
            },
            
            {
                "id": "n14",
                "type": "ExportReportNode",
                "name": "导出审计报告",
                "params": {
                    "export_format": "excel"
                },
                "position": {"x": 2100, "y": 200}
            }
        ],
        
        # 定义连接关系
        "edges": [
            # 数据流主线
            {"from": "n1", "to": "n2", "from_slot": 0, "to_slot": 0},  # Excel -> 列映射
            {"from": "n2", "to": "n3", "from_slot": 0, "to_slot": 0},  # 列映射 -> 空值清理
            {"from": "n3", "to": "n4", "from_slot": 0, "to_slot": 0},  # 空值清理 -> 通用指标
            {"from": "n3", "to": "n5", "from_slot": 0, "to_slot": 0},  # 空值清理 -> 场景指标
            {"from": "n3", "to": "n7", "from_slot": 0, "to_slot": 0},  # 空值清理 -> 金额验证
            
            # 指标流向规则
            {"from": "n4", "to": "n6", "from_slot": 0, "to_slot": 1},  # 通用指标 -> 规则计算
            {"from": "n5", "to": "n6", "from_slot": 0, "to_slot": 2},  # 场景指标 -> 规则计算
            {"from": "n3", "to": "n6", "from_slot": 0, "to_slot": 0},  # 数据 -> 规则计算
            
            # 文本分析
            {"from": "n3", "to": "n8", "from_slot": 0, "to_slot": 0},  # 数据 -> 文本AI
            
            # 综合分析
            {"from": "n6", "to": "n9", "from_slot": 0, "to_slot": 0},  # 规则结果 -> 综合分析
            {"from": "n4", "to": "n9", "from_slot": 0, "to_slot": 1},  # 指标 -> 综合分析
            {"from": "n8", "to": "n9", "from_slot": 0, "to_slot": 2},  # 文本分析 -> 综合分析
            
            # 人工审核
            {"from": "n6", "to": "n10", "from_slot": 0, "to_slot": 0}, # 风险项 -> 人工审核
            {"from": "n9", "to": "n10", "from_slot": 0, "to_slot": 1}, # 风险评估 -> 人工审核
            
            # 可视化
            {"from": "n3", "to": "n11", "from_slot": 0, "to_slot": 0}, # 数据 -> 图表
            {"from": "n7", "to": "n12", "from_slot": 0, "to_slot": 0}, # 异常数据 -> 表格
            
            # 报告生成
            {"from": "n10", "to": "n13", "from_slot": 0, "to_slot": 0}, # 审核结果 -> 结果生成
            {"from": "n9", "to": "n13", "from_slot": 0, "to_slot": 1},  # 风险评估 -> 结果生成
            {"from": "n13", "to": "n14", "from_slot": 0, "to_slot": 0}, # 结果 -> 导出
        ]
    }
    
    return workflow


def export_workflow_json(workflow):
    """导出工作流为JSON格式"""
    
    os.makedirs('backend/workflows', exist_ok=True)
    file_path = 'backend/workflows/invoice_audit_workflow.json'
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(workflow, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 工作流已导出: {file_path}")
    return file_path


def main():
    """主函数：创建并导出完整的审计工作流"""
    
    print("=" * 60)
    print("🎯 发票审计工作流示例")
    print("=" * 60)
    
    # 步骤1：创建示例数据
    print("\n📊 步骤1: 创建示例发票数据...")
    data_file = create_sample_invoice_data()
    
    # 步骤2：构建工作流
    print("\n🔧 步骤2: 构建审计工作流...")
    workflow = build_invoice_audit_workflow()
    
    # 步骤3：导出工作流
    print("\n💾 步骤3: 导出工作流配置...")
    workflow_file = export_workflow_json(workflow)
    
    # 步骤4：输出执行指南
    print("\n" + "=" * 60)
    print("✅ 工作流创建完成！")
    print("\n📝 执行指南：")
    print("1. 启动后端服务:")
    print("   cd backend")
    print("   python -m uvicorn app.main:app --reload")
    print("\n2. 启动前端服务:")
    print("   cd ..")
    print("   npm run dev")
    print("\n3. 在前端界面:")
    print("   - 点击'导入工作流'按钮")
    print(f"   - 选择文件: {workflow_file}")
    print("   - 点击'运行审计'执行工作流")
    print("\n4. 查看结果:")
    print("   - 点击节点上的👁️图标查看输出")
    print("   - 审计报告将保存在: backend/output/reports/")
    print("=" * 60)
    
    # 输出工作流统计
    print(f"\n📊 工作流统计:")
    print(f"   - 节点总数: {len(workflow['nodes'])}")
    print(f"   - 连接总数: {len(workflow['edges'])}")
    print(f"   - 涉及层级: 5层")
    print(f"   - 核心功能: 数据采集→清洗→指标计算→规则检查→AI分析→人工审核→报告生成")


if __name__ == "__main__":
    main()
