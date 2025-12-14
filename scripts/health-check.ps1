# 审计底稿引擎 - 健康检查脚本
# 使用方法: .\health-check.ps1

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "审计底稿引擎 - 健康检查" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# 检查Docker服务状态
Write-Host "1. 检查Docker容器状态..." -ForegroundColor Yellow
docker-compose -p audit-engine ps

# 检查后端健康
Write-Host "`n2. 检查后端API健康..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri http://localhost:3002/api/nodes -UseBasicParsing -TimeoutSec 5
    $nodes = ($response.Content | ConvertFrom-Json).data
    Write-Host "✅ 后端API正常 - 已注册 $($nodes.Count) 个节点" -ForegroundColor Green
} catch {
    Write-Host "❌ 后端API异常: $($_.Exception.Message)" -ForegroundColor Red
}

# 检查前端
Write-Host "`n3. 检查前端服务..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri http://localhost:8080/ -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ 前端服务正常 (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ 前端服务异常: $($_.Exception.Message)" -ForegroundColor Red
}

# 检查数据库连接
Write-Host "`n4. 检查数据库连接..." -ForegroundColor Yellow
docker-compose -p audit-engine exec -T postgres pg_isready -U postgres
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL连接正常" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL连接失败" -ForegroundColor Red
}

# 检查Redis连接
Write-Host "`n5. 检查Redis连接..." -ForegroundColor Yellow
docker-compose -p audit-engine exec -T redis redis-cli ping
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Redis连接正常" -ForegroundColor Green
} else {
    Write-Host "❌ Redis连接失败" -ForegroundColor Red
}

# 检查后端日志错误
Write-Host "`n6. 检查后端错误日志（最近20行）..." -ForegroundColor Yellow
docker-compose -p audit-engine logs backend --tail=20 | Select-String "error|Error|ERROR|failed|Failed" -Context 0,1

# 资源使用情况
Write-Host "`n7. Docker容器资源使用..." -ForegroundColor Yellow
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" audit-engine-backend audit-engine-frontend audit-engine-db audit-engine-redis

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "健康检查完成！" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan
