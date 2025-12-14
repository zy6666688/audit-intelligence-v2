@echo off
chcp 65001 > nul
echo.
echo ================================
echo 审计底稿引擎 - 健康检查
echo ================================
echo.

echo 1. 检查Docker容器状态...
docker-compose -p audit-engine ps
echo.

echo 2. 检查后端API...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3002/api/nodes' -UseBasicParsing -TimeoutSec 5; $d = ($r.Content | ConvertFrom-Json).data; Write-Host '✅ 后端API正常 - 已注册' $d.Count '个节点' -ForegroundColor Green } catch { Write-Host '❌ 后端API异常' -ForegroundColor Red }"
echo.

echo 3. 检查前端服务...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8080/' -UseBasicParsing -TimeoutSec 5; Write-Host '✅ 前端服务正常' -ForegroundColor Green } catch { Write-Host '❌ 前端服务异常' -ForegroundColor Red }"
echo.

echo 4. 检查PostgreSQL...
docker-compose -p audit-engine exec -T postgres pg_isready -U postgres
echo.

echo 5. 检查Redis...
docker-compose -p audit-engine exec -T redis redis-cli ping
echo.

echo 6. 容器资源使用...
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" audit-engine-backend audit-engine-frontend audit-engine-db audit-engine-redis
echo.

echo ================================
echo 健康检查完成！
echo ================================
pause
