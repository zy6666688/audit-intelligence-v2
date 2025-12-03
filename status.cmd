@echo off
chcp 65001 > nul
title 审计数智析 - 服务状态

echo.
echo ========================================
echo   审计数智析 - 服务状态
echo ========================================
echo.

echo 📊 容器运行状态:
echo.
docker-compose -p audit-engine ps
echo.

echo 📈 资源使用情况:
echo.
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" audit-engine-backend audit-engine-frontend audit-engine-db audit-engine-redis 2>nul
echo.

echo ========================================
echo   服务访问地址:
echo ========================================
echo   🌐 前端: http://localhost:8080
echo   🔌 后端: http://localhost:3002
echo   📚 API:  http://localhost:3002/api/nodes
echo.

:: 测试后端连接
echo 🔍 测试后端连接...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3002/api/nodes' -UseBasicParsing -TimeoutSec 3; Write-Host '  ✅ 后端API正常' -ForegroundColor Green } catch { Write-Host '  ❌ 后端API无响应' -ForegroundColor Red }"

:: 测试前端连接
echo 🔍 测试前端连接...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8080/' -UseBasicParsing -TimeoutSec 3; Write-Host '  ✅ 前端服务正常' -ForegroundColor Green } catch { Write-Host '  ❌ 前端服务无响应' -ForegroundColor Red }"

echo.
echo ========================================
pause
