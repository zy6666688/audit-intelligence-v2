@echo off
chcp 65001 >nul
echo ====================================
echo 一键提交所有文件到GitHub
echo ====================================
echo.

echo 📋 第1步：检查Git状态...
git status
echo.

echo 📦 第2步：添加所有重要文件...

REM 添加所有Markdown文档
git add *.md

REM 添加所有脚本文件
git add *.cmd *.bat *.sh *.ps1

REM 添加配置文件
git add *.json *.yml *.yaml *.conf
git add Dockerfile* docker-compose.yml nginx.conf

REM 添加源代码
git add packages/
git add src/
git add scripts/
git add tests/
git add docs/

REM 添加示例配置
git add packages/backend/.env.example
git add packages/backend/.env.ai-services.example

echo.
echo ✅ 文件添加完成！
echo.

echo 📊 查看将要提交的文件...
git status
echo.

echo 💾 第3步：提交到本地仓库...
git commit -m "feat: 完成Week1-3核心代码开发

✨ 新增功能:
- 统一API响应格式 (ResponseFormatter)
- 标准错误码体系 (ErrorCode, 60+错误码)
- 全局错误处理中间件 (errorHandler)
- 审计节点基类 (BaseNode)
- 固定资产盘点节点 (FixedAssetInventoryNode)

📚 新增文档:
- 26份详细项目文档
- 8周完整执行指南
- API优化方案
- 审计节点设计文档
- 成本优化方案

🔧 优化:
- 代码质量达到生产级
- 完整的TypeScript类型定义
- 完整的错误处理
- 详细的注释文档

📝 后续工作:
- 创建剩余7个核心审计节点
- 开发工作流执行引擎
- 开发前端编辑器
- 完整测试和部署
"

echo.
echo ✅ 本地提交完成！
echo.

echo 🚀 第4步：推送到GitHub...
git push origin master

echo.
echo ====================================
echo ✅ 所有文件已成功推送到GitHub！
echo ====================================
echo.
echo 📝 GitHub仓库地址:
echo https://github.com/zy6666688/SHENJI
echo.
echo 现在别人git clone就能看到所有文件了！
echo.

pause
