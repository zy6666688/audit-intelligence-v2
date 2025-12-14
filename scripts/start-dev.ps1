# 审计数智析 - 开发环境一键启动脚本
# PowerShell 版本

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  审计数智析 - 开发环境启动" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
Write-Host "[1/4] 检查 Node.js 环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 Node.js，请先安装 Node.js 18+" -ForegroundColor Red
    exit 1
}

# 安装依赖（如果需要）
Write-Host ""
Write-Host "[2/4] 检查依赖..." -ForegroundColor Yellow
if (-Not (Test-Path "node_modules")) {
    Write-Host "正在安装前端依赖..." -ForegroundColor Yellow
    npm install
}
if (-Not (Test-Path "packages\backend\node_modules")) {
    Write-Host "正在安装后端依赖..." -ForegroundColor Yellow
    Set-Location packages\backend
    npm install
    Set-Location ..\..
}
Write-Host "✓ 依赖检查完成" -ForegroundColor Green

# 启动后端服务
Write-Host ""
Write-Host "[3/4] 启动后端服务..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\packages\backend'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 3
Write-Host "✓ 后端服务已启动: http://localhost:3000" -ForegroundColor Green

# 启动前端服务
Write-Host ""
Write-Host "[4/4] 启动前端服务..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev:h5" -WindowStyle Normal
Start-Sleep -Seconds 2
Write-Host "✓ 前端服务已启动: http://localhost:8080" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  🎉 开发环境启动完成！" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "前端地址: http://localhost:8080" -ForegroundColor Cyan
Write-Host "后端地址: http://localhost:3000" -ForegroundColor Cyan
Write-Host "后端健康检查: http://localhost:3000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止各个服务窗口" -ForegroundColor Yellow
Write-Host ""
