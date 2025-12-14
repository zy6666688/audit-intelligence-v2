# Git提交脚本 - 只提交V3节点系统
Write-Host "🎯 准备提交V3节点系统..." -ForegroundColor Cyan
Write-Host ""

# 确认用户想要继续
Write-Host "📋 将要提交的内容:" -ForegroundColor Yellow
Write-Host "  ✓ V3节点系统（13个节点 + 测试）"
Write-Host "  ✓ 新整理的文档"
Write-Host "  ✓ 根目录核心文件"
Write-Host ""

$confirm = Read-Host "确认只提交V3相关文件? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "❌ 已取消" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "📦 添加V3节点文件..." -ForegroundColor Cyan

# 添加V3节点核心文件
git add packages/backend/src/nodes/v3/

# 添加类型定义
git add packages/backend/src/types/AuditDataTypes.ts

# 添加编译器（如果存在）
if (Test-Path "packages/backend/src/compiler") {
    git add packages/backend/src/compiler/
}

# 添加新整理的文档
git add docs/architecture/
git add docs/development/
git add docs/deployment/
git add docs/reports/
git add docs/文档整理说明.md

# 添加根目录文件
git add README.md
git add 快速开始.md
git add CONTRIBUTING.md
git add KNOWN_ISSUES.md
git add GIT_COMMIT_PLAN.md
git add PRE_COMMIT_CHECKLIST.md
git add 代码健康检查报告.md
git add 项目清理完成报告.md
git add GIT_CLEAN_COMMIT_PLAN.md

Write-Host ""
Write-Host "✅ 文件添加完成" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Staged文件:" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "📈 变更统计:" -ForegroundColor Cyan
git diff --cached --stat

Write-Host ""
Write-Host "✅ 准备就绪！" -ForegroundColor Green
Write-Host ""
Write-Host "📤 下一步:" -ForegroundColor Yellow
Write-Host "  1. 检查staged文件是否正确"
Write-Host "  2. 运行 .\git-commit.ps1 执行提交"
Write-Host "  3. 推送到远程"
