# 🧹 代码清理计划

**执行时间**: 2025-12-01 15:25  
**目标**: 清理迁移后的冗余文件和过时架构

---

## 📋 清理清单

### 1. 冗余的Canvas组件（已删除）
- [x] `src/components/workflow/FlowCanvasMiniapp.vue` - 已删除

### 2. 过时的测试脚本（可选择性保留）
保留，作为历史记录：
- `test-features.ps1` - 旧版测试
- `test-all-features.ps1` - 旧版全功能测试
- `test-engine-api.ps1` - Engine API测试

### 3. 重复的文档（建议清理）
需要清理的重复文档：
- `OPTIMIZATION_COMPLETE.md` - 被新报告替代
- `FRONTEND_BACKEND_READY.md` - 被新报告替代
- `OPTIMIZATION_AND_VERIFICATION_REPORT.md` - 被新报告替代
- `优化验证完成总结.md` - 中文版，内容重复

### 4. 旧的完成报告（建议归档）
可以归档到 `docs/archive/` 目录：
- `FINAL_STATUS.md` - 被 `MIGRATION_COMPLETE_REPORT.md` 替代
- `SYSTEM_STATUS.md` - 内容过时
- `COMFYUI_FEATURES_COMPLETE.md` - 被新文档包含
- `FEATURES_EXPANSION_COMPLETE.md` - 被新文档包含
- `ALL_DONE_SUMMARY.md` - 被新文档包含

### 5. API封装文件（检查是否使用）
- `src/api/workflowApi.ts` - 为H5端准备的，保留

---

## ✅ 推荐的文件结构

### 核心文档（保留）
```
根目录/
├── README.md                          ⭐ 项目入口
├── DUAL_FRONTEND_ARCHITECTURE.md      ⭐ 架构设计
├── 双前端架构迁移指南.md               ⭐ 迁移指南
├── MIGRATION_IMPLEMENTATION_PLAN.md   ⭐ 实施计划
└── MIGRATION_COMPLETE_REPORT.md       ⭐ 完成报告
```

### 归档文档（移动到 docs/archive/）
```
docs/archive/
├── OPTIMIZATION_COMPLETE.md
├── FRONTEND_BACKEND_READY.md
├── OPTIMIZATION_AND_VERIFICATION_REPORT.md
├── 优化验证完成总结.md
├── FINAL_STATUS.md
├── SYSTEM_STATUS.md
├── COMFYUI_FEATURES_COMPLETE.md
├── FEATURES_EXPANSION_COMPLETE.md
└── ALL_DONE_SUMMARY.md
```

### 测试脚本（移动到 tests/）
```
tests/
├── test-miniapp-migration.ps1         ⭐ 最新测试
├── test-features.ps1                  📦 归档
├── test-all-features.ps1              📦 归档
└── test-engine-api.ps1                📦 归档
```

---

## 🗂️ 执行清理

### 步骤1: 创建归档目录
```powershell
New-Item -ItemType Directory -Path "docs/archive" -Force
New-Item -ItemType Directory -Path "tests" -Force
```

### 步骤2: 移动文档到归档
```powershell
Move-Item "OPTIMIZATION_COMPLETE.md" "docs/archive/"
Move-Item "FRONTEND_BACKEND_READY.md" "docs/archive/"
Move-Item "OPTIMIZATION_AND_VERIFICATION_REPORT.md" "docs/archive/"
Move-Item "优化验证完成总结.md" "docs/archive/"
Move-Item "FINAL_STATUS.md" "docs/archive/"
Move-Item "SYSTEM_STATUS.md" "docs/archive/"
Move-Item "COMFYUI_FEATURES_COMPLETE.md" "docs/archive/"
Move-Item "FEATURES_EXPANSION_COMPLETE.md" "docs/archive/"
Move-Item "ALL_DONE_SUMMARY.md" "docs/archive/"
```

### 步骤3: 移动测试脚本
```powershell
Move-Item "test-miniapp-migration.ps1" "tests/"
Move-Item "test-features.ps1" "tests/" -ErrorAction SilentlyContinue
Move-Item "test-all-features.ps1" "tests/" -ErrorAction SilentlyContinue
Move-Item "test-engine-api.ps1" "tests/" -ErrorAction SilentlyContinue
```

### 步骤4: 更新 README.md
添加归档说明和新的文档链接。

---

## 📊 清理后的目录结构

```
审计数智析/
├── README.md                               ⭐ 主文档
├── DUAL_FRONTEND_ARCHITECTURE.md           ⭐ 架构
├── 双前端架构迁移指南.md                    ⭐ 指南
├── MIGRATION_IMPLEMENTATION_PLAN.md        ⭐ 计划
├── MIGRATION_COMPLETE_REPORT.md            ⭐ 报告
├── CLEANUP_PLAN.md                         📋 本文档
│
├── docs/
│   ├── archive/                            📦 历史文档
│   │   ├── OPTIMIZATION_COMPLETE.md
│   │   ├── FRONTEND_BACKEND_READY.md
│   │   └── ...
│   ├── ARCHITECTURE.md
│   └── WORKPAPER_ARCHITECTURE.md
│
├── tests/                                  🧪 测试脚本
│   ├── test-miniapp-migration.ps1         ⭐ 主测试
│   └── ...                                📦 旧测试
│
├── packages/
│   └── backend/
│       └── src/
│           ├── index.ts                   ✅ 已优化
│           └── nodes/
│               ├── BusinessNodes.ts       ✅ 新增
│               └── ...
│
├── src/
│   ├── pages-miniapp/                     ⭐ 新架构
│   │   └── workflow/
│   │       ├── list.vue                   ✅ 新增
│   │       ├── detail.vue                 ✅ 新增
│   │       ├── execute.vue                ✅ 新增
│   │       └── result.vue                 ✅ 新增
│   │
│   ├── components/workflow/
│   │   └── GraphCanvasWeb.vue             ✅ H5端保留
│   │
│   └── api/
│       └── workflowApi.ts                 ✅ API封装
│
└── start-dev.ps1                          🚀 启动脚本
```

---

## 🎯 清理收益

### 文件数量
- **清理前**: ~50个文档
- **清理后**: 5个核心文档 + 归档
- **减少**: 90%的根目录混乱

### 文档结构
- ✅ 核心文档清晰
- ✅ 历史文档归档
- ✅ 测试脚本集中
- ✅ 易于维护

---

## ⚠️ 注意事项

1. **不删除，只移动** - 所有文档保留，移至归档
2. **保留引用** - README中添加归档链接
3. **测试验证** - 移动后确保路径正确

---

**执行**: 立即开始清理
