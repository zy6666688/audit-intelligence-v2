@echo off
chcp 65001 >nul
echo ====================================
echo 检查将要提交到GitHub的文件
echo ====================================
echo.

echo 📋 当前未跟踪的重要文件：
echo.

echo 【核心代码文件】
if exist "packages\backend\src\utils\ResponseFormatter.ts" echo ✅ ResponseFormatter.ts
if exist "packages\backend\src\constants\ErrorCode.ts" echo ✅ ErrorCode.ts
if exist "packages\backend\src\middleware\errorHandler.ts" echo ✅ errorHandler.ts
if exist "packages\backend\src\nodes\BaseNode.ts" echo ✅ BaseNode.ts
if exist "packages\backend\src\nodes\FixedAssetInventoryNode.ts" echo ✅ FixedAssetInventoryNode.ts
echo.

echo 【重要文档】
if exist "从0到落地完整指南.md" echo ✅ 从0到落地完整指南.md
if exist "Week0_极简版执行清单.md" echo ✅ Week0_极简版执行清单.md
if exist "文档索引_完整版.md" echo ✅ 文档索引_完整版.md
if exist "执行报告_已完成工作.md" echo ✅ 执行报告_已完成工作.md
if exist "自检验收报告_最终版.md" echo ✅ 自检验收报告_最终版.md
if exist "您回来后_立即执行这个.md" echo ✅ 您回来后_立即执行这个.md
if exist "API问题清单与优化方案.md" echo ✅ API问题清单与优化方案.md
if exist "审计业务循环节点设计.md" echo ✅ 审计业务循环节点设计.md
if exist "基础设施成本优化方案.md" echo ✅ 基础设施成本优化方案.md
if exist "AI服务配置说明.md" echo ✅ AI服务配置说明.md
echo.

echo 【配置文件】
if exist "packages\backend\.env.example" echo ✅ .env.example
if exist "packages\backend\.env.ai-services.example" echo ✅ .env.ai-services.example
if exist "packages\backend\package.json" echo ✅ package.json
if exist "docker-compose.yml" echo ✅ docker-compose.yml
echo.

echo 【脚本文件】
if exist "INSTALL_DEPENDENCIES.sh" echo ✅ INSTALL_DEPENDENCIES.sh
if exist "start.sh" echo ✅ start.sh
if exist "start.cmd" echo ✅ start.cmd
echo.

echo ====================================
echo.
echo 💡 提示：运行以下命令查看详细状态
echo    git status
echo.
echo 🚀 准备好后，运行以下脚本提交：
echo    一键提交到GitHub.cmd
echo.

pause
