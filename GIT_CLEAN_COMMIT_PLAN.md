# 🎯 Git干净提交计划

**创建时间**: 2025-12-02 20:09  
**问题**: 发现大量旧文件混入Git staged区域

---

## ⚠️ 发现的问题

### 问题描述
运行`git status`发现有94个文件变更，其中包含大量不应该提交的旧文档：
- `docs/refactoring/` 目录下的旧架构文档（30+个文件）
- `docs/Vol1-4` 系列旧文档
- 临时修复文档（FIXES_APPLIED.md等）

### 影响
- 会污染Git历史
- 提交混乱，难以review
- 包含大量无关内容

---

## ✅ 解决方案

### 步骤1: 重置Git状态
```bash
# 取消所有staged文件
git reset HEAD

# 查看当前状态
git status
```

### 步骤2: 清理不需要的文件
```bash
# 删除旧文档目录
Remove-Item -Path "docs/refactoring" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "docs/Vol*.md" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "docs/V4*.md" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "docs/AUDIT*.md" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "docs/Documentation*.md" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "docs/Engineering*.md" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "docs/RULES*.md" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "docs/README_v4*.md" -Force -ErrorAction SilentlyContinue
```

### 步骤3: 只添加V3节点相关文件
```bash
# V3节点核心文件
git add packages/backend/src/nodes/v3/
git add packages/backend/src/types/AuditDataTypes.ts
git add packages/backend/src/compiler/

# 新文档
git add docs/architecture/
git add docs/development/
git add docs/deployment/
git add docs/reports/
git add docs/文档整理说明.md

# 根目录核心文件
git add README.md
git add 快速开始.md
git add CONTRIBUTING.md
git add KNOWN_ISSUES.md
git add GIT_COMMIT_PLAN.md
git add PRE_COMMIT_CHECKLIST.md
git add 代码健康检查报告.md
git add 项目清理完成报告.md
```

---

## 📋 应该提交的文件清单

### V3节点系统（核心）
```
packages/backend/src/nodes/v3/
├── BaseNode.ts
├── NodeRegistryV3.ts
├── index.ts
├── input/
│   ├── RecordsInputNode.ts
│   ├── VoucherInputNode.ts
│   ├── ContractInputNode.ts
│   ├── BankFlowInputNode.ts
│   └── InvoiceInputNode.ts
├── preprocess/
│   ├── OCRExtractNode.ts
│   ├── FieldMapperNode.ts
│   ├── NormalizeDataNode.ts
│   └── DeduplicateNode.ts
├── audit/
│   ├── ThreeDocMatchNode.ts
│   └── FundLoopDetectNode.ts
├── ai/
│   └── AIFraudScorerNode.ts
├── output/
│   └── WorkpaperGeneratorNode.ts
├── utils/
│   ├── DataValidator.ts
│   ├── PerformanceMonitor.ts
│   └── CacheManager.ts
└── __tests__/
    ├── test-framework.ts
    └── [11个测试文件]
```

### 类型和编译器
```
packages/backend/src/
├── types/AuditDataTypes.ts
└── compiler/
```

### 文档（新整理的）
```
docs/
├── 文档整理说明.md
├── architecture/
│   ├── 架构重构计划.md
│   ├── V3架构完成总结.md
│   └── Phase_A_MVP完成报告.md
├── development/
│   ├── V3节点使用手册.md
│   ├── 节点配置指南.md
│   └── 测试结果总结.md
├── deployment/
│   └── 部署指南.md
└── reports/
    ├── Phase_B_Week1-2_完成总结.md
    ├── Phase_B_功能检查报告.md
    └── 任务完成总结.md
```

### 根目录
```
├── README.md (更新)
├── 快速开始.md
├── CONTRIBUTING.md
├── KNOWN_ISSUES.md
├── GIT_COMMIT_PLAN.md
├── PRE_COMMIT_CHECKLIST.md
├── 代码健康检查报告.md
└── 项目清理完成报告.md
```

---

## 🗑️ 不应该提交的文件

### 旧架构文档（删除）
- `docs/refactoring/` 全部
- `docs/Vol1_System_Architecture.md`
- `docs/Vol2_Node_Reference.md`
- `docs/Vol4_Developer_Guide.md`
- `docs/Vol4_Part1_Architecture.md`
- `docs/Vol4_Part2_Development.md`
- `docs/V4_Optimization_Report.md`
- `docs/V4.1_Optimization_Report.md`

### 临时文档（删除）
- `FIXES_APPLIED.md`
- `PROJECT_DELIVERABLES.md`
- `PUSH_TO_REMOTE.md`
- `TYPE_FIXES.md`
- `docs/AUDIT_ENGINE_MANUAL.md`
- `docs/AUDIT_WORKPAPER_RULES.md`
- `docs/Documentation_*.md`
- `docs/Engineering_*.md`
- `docs/RULES_*.md`

### 临时脚本（删除）
- `scripts/setup-day*.bat`
- `scripts/setup-day*.sh`
- `scripts/start-day*.bat`

---

## 🔄 执行步骤

### 1. 重置Git状态
```powershell
git reset HEAD
git status
```

### 2. 清理旧文件
```powershell
.\clean-old-docs.ps1
```

### 3. 验证清理结果
```powershell
git status --short
# 应该只显示 V3 相关的未追踪文件
```

### 4. 添加正确的文件
```powershell
.\git-commit-v3-only.ps1
```

### 5. 验证staged文件
```powershell
git status
git diff --cached --stat
# 应该只有 V3 相关文件
```

### 6. 执行提交
```powershell
.\git-commit.ps1
```

---

## 📊 预期结果

### 文件统计
- **新增文件**: ~45个（只包含V3节点系统）
- **修改文件**: ~5个（README等）
- **删除文件**: 0个
- **代码行数**: ~17,000 lines

### 提交数量
- **7个提交**（按git-commit.ps1脚本）
- 每个提交清晰、独立、可审查

### Git历史
- 清晰的提交历史
- 每个提交都有明确的purpose
- 易于review和回滚

---

## ⚠️ 注意事项

1. **不要提交旧文档**: docs/refactoring不属于V3节点系统
2. **检查每个文件**: 确保只提交相关文件
3. **保持提交干净**: 一个feature一个branch
4. **验证后再push**: 本地验证通过后再推送远程

---

## ✅ 验证清单

- [ ] Git状态已重置
- [ ] 旧文件已删除
- [ ] 只staged V3相关文件
- [ ] TypeScript编译通过
- [ ] 测试通过
- [ ] 文档完整
- [ ] 提交信息准确

---

**计划创建时间**: 2025-12-02 20:09  
**执行状态**: 待执行  
**下一步**: 运行清理脚本
