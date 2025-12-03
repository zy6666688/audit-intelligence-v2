# 测试 Engine API
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  测试 Engine API" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# 1. 提交任务
Write-Host "`n[1] 提交加法任务..." -ForegroundColor Yellow
$body = @{
    nodeId = "test-node-1"
    type = "simple_add"
    config = @{}
    inputs = @{
        a = 10
        b = 20
    }
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/engine/dispatch" -Method Post -Body $body -ContentType "application/json"
$taskId = $response.data.taskId
Write-Host "✓ 任务已提交" -ForegroundColor Green
Write-Host "  TaskID: $taskId" -ForegroundColor Cyan
Write-Host "  状态: $($response.data.status)" -ForegroundColor Cyan

# 2. 等待任务完成
Write-Host "`n[2] 等待任务执行..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# 3. 查询任务状态
Write-Host "`n[3] 查询任务结果..." -ForegroundColor Yellow
$statusResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/engine/tasks/$taskId" -Method Get
Write-Host "✓ 任务状态: $($statusResponse.data.status)" -ForegroundColor Green
Write-Host "  进度: $($statusResponse.data.progress)%" -ForegroundColor Cyan

if ($statusResponse.data.result) {
    $resultJson = $statusResponse.data.result | ConvertTo-Json -Compress
    Write-Host "  结果: $resultJson" -ForegroundColor Green
} else {
    Write-Host "  结果: 暂无（可能还在执行中）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Engine API 测试完成" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
