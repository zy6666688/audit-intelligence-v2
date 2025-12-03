# 审计底稿引擎 - 健康检查脚本
# 使用方法: .\health-check-simple.ps1

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "审计底稿引擎 - 健康检查" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查Docker容器状态
Write-Host "1. 检查Docker容器状态..." -ForegroundColor Yellow
docker-compose -p audit-engine ps
Write-Host ""

# 2. 检查后端API健康
Write-Host "2. 检查后端API健康..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3002/api/nodes" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    $nodeCount = $data.data.Count
    Write-Host "✅ 后端API正常 - 已注册 $nodeCount 个节点" -ForegroundColor Green
}
catch {
    Write-Host "❌ 后端API异常: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 3. 检查前端服务
Write-Host "3. 检查前端服务..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ 前端服务正常 (HTTP $($response.StatusCode))" -ForegroundColor Green
}
catch {
    Write-Host "❌ 前端服务异常: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 4. 检查数据库连接
Write-Host "4. 检查数据库连接..." -ForegroundColor Yellow
$dbCheck = docker-compose -p audit-engine exec -T postgres pg_isready -U postgres 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL连接正常" -ForegroundColor Green
}
else {
    Write-Host "❌ PostgreSQL连接失败" -ForegroundColor Red
}
Write-Host ""

# 5. 检查Redis连接
Write-Host "5. 检查Redis连接..." -ForegroundColor Yellow
$redisCheck = docker-compose -p audit-engine exec -T redis redis-cli ping 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Redis连接正常" -ForegroundColor Green
}
else {
    Write-Host "❌ Redis连接失败" -ForegroundColor Red
}
Write-Host ""

# 6. 检查后端错误日志
Write-Host "6. 检查后端错误日志（最近10行）..." -ForegroundColor Yellow
docker-compose -p audit-engine logs backend --tail=10 | Select-String -Pattern "error|Error|ERROR|failed|Failed" -Context 0,1
Write-Host ""

# 7. Docker容器资源使用
Write-Host "7. Docker容器资源使用..." -ForegroundColor Yellow
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" audit-engine-backend audit-engine-frontend audit-engine-db audit-engine-redis 2>$null
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "健康检查完成！" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
