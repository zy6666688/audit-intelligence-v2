# 审计数智析 - 完整功能测试脚本
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  完整功能测试" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:3000"
$testsPassed = 0
$testsFailed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    
    Write-Host "`n[TEST] $Name..." -ForegroundColor Yellow
    try {
        & $Test
        Write-Host "  ✓ PASSED" -ForegroundColor Green
        $script:testsPassed++
    } catch {
        Write-Host "  ✗ FAILED: $_" -ForegroundColor Red
        $script:testsFailed++
    }
}

# 测试 1: 健康检查
Test-Endpoint "健康检查 (GET /health)" {
    $health = Invoke-RestMethod -Uri "$baseUrl/health"
    if ($health.status -ne "ok") { throw "Status not ok" }
    if (-not $health.uptime) { throw "No uptime info" }
    if (-not $health.memory) { throw "No memory info" }
    if (-not $health.tasks) { throw "No tasks info" }
    Write-Host "    Uptime: $($health.uptime)" -ForegroundColor Cyan
    Write-Host "    Memory: $($health.memory.heapUsed)" -ForegroundColor Cyan
    Write-Host "    Active tasks: $($health.tasks.active)" -ForegroundColor Cyan
}

# 测试 2: 获取节点列表
Test-Endpoint "获取节点列表 (GET /api/nodes)" {
    $nodes = Invoke-RestMethod -Uri "$baseUrl/api/nodes"
    if (-not $nodes.success) { throw "Request failed" }
    if ($nodes.data.Count -lt 3) { throw "Expected at least 3 nodes" }
    Write-Host "    Found $($nodes.data.Count) nodes" -ForegroundColor Cyan
}

# 测试 3: 获取单个节点信息
Test-Endpoint "获取节点详情 (GET /api/nodes/:type)" {
    $node = Invoke-RestMethod -Uri "$baseUrl/api/nodes/simple_add"
    if (-not $node.success) { throw "Request failed" }
    if ($node.data.type -ne "simple_add") { throw "Wrong node type" }
    Write-Host "    Node: $($node.data.name)" -ForegroundColor Cyan
    Write-Host "    Version: $($node.data.version)" -ForegroundColor Cyan
}

# 测试 4: 直接执行节点
Test-Endpoint "直接执行节点 (POST /api/nodes/:type/execute)" {
    $body = @{
        inputs = @{ a = 15; b = 25 }
        config = @{}
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$baseUrl/api/nodes/simple_add/execute" -Method Post -Body $body -ContentType "application/json"
    if (-not $result.success) { throw "Execution failed" }
    if ($result.data.sum -ne 40) { throw "Wrong result: expected 40, got $($result.data.sum)" }
    Write-Host "    Result: 15 + 25 = $($result.data.sum)" -ForegroundColor Cyan
    Write-Host "    Duration: $($result.metadata.duration)ms" -ForegroundColor Cyan
}

# 测试 5: Engine API - 提交任务
Test-Endpoint "提交任务 (POST /api/engine/dispatch)" {
    $body = @{
        nodeId = "test-node-comprehensive"
        type = "simple_multiply"
        config = @{}
        inputs = @{ a = 7; b = 8 }
    } | ConvertTo-Json
    
    $submit = Invoke-RestMethod -Uri "$baseUrl/api/engine/dispatch" -Method Post -Body $body -ContentType "application/json"
    if ($submit.code -ne 200) { throw "Submission failed" }
    if (-not $submit.data.taskId) { throw "No taskId returned" }
    
    $script:taskId = $submit.data.taskId
    Write-Host "    TaskID: $taskId" -ForegroundColor Cyan
    Write-Host "    Status: $($submit.data.status)" -ForegroundColor Cyan
}

# 测试 6: Engine API - 查询任务状态（立即）
Test-Endpoint "查询任务状态 - 立即 (GET /api/engine/tasks/:id)" {
    if (-not $script:taskId) { throw "No taskId from previous test" }
    
    $status = Invoke-RestMethod -Uri "$baseUrl/api/engine/tasks/$taskId"
    if ($status.code -ne 200) { throw "Status check failed" }
    Write-Host "    Status: $($status.data.status)" -ForegroundColor Cyan
    Write-Host "    Progress: $($status.data.progress)%" -ForegroundColor Cyan
}

# 测试 7: Engine API - 等待任务完成
Test-Endpoint "等待任务完成 (轮询)" {
    if (-not $script:taskId) { throw "No taskId from previous test" }
    
    $maxAttempts = 10
    $attempt = 0
    $completed = $false
    
    while ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 1
        $status = Invoke-RestMethod -Uri "$baseUrl/api/engine/tasks/$taskId"
        
        Write-Host "    Attempt $($attempt + 1): $($status.data.status) ($($status.data.progress)%)" -ForegroundColor Gray
        
        if ($status.data.status -eq "completed") {
            $completed = $true
            if ($status.data.result.product -ne 56) {
                throw "Wrong result: expected 56, got $($status.data.result.product)"
            }
            Write-Host "    Result: 7 × 8 = $($status.data.result.product)" -ForegroundColor Cyan
            break
        } elseif ($status.data.status -eq "failed") {
            throw "Task failed: $($status.data.error)"
        }
        
        $attempt++
    }
    
    if (-not $completed) {
        throw "Task did not complete in time"
    }
}

# 测试 8: 404 错误处理
Test-Endpoint "404 错误处理" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/nonexistent" -ErrorAction Stop
        throw "Should have received 404"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 404) {
            throw "Expected 404, got $($_.Exception.Response.StatusCode.value__)"
        }
        Write-Host "    Correctly returned 404" -ForegroundColor Cyan
    }
}

# 测试 9: 无效参数错误处理
Test-Endpoint "无效参数错误处理" {
    try {
        $body = @{ invalid = "data" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/api/engine/dispatch" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        throw "Should have received 400"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 400) {
            throw "Expected 400, got $($_.Exception.Response.StatusCode.value__)"
        }
        Write-Host "    Correctly returned 400" -ForegroundColor Cyan
    }
}

# 测试 10: 最终健康检查（查看统计）
Test-Endpoint "最终健康检查（统计验证）" {
    $health = Invoke-RestMethod -Uri "$baseUrl/health"
    Write-Host "    Total tasks: $($health.tasks.stats.total)" -ForegroundColor Cyan
    Write-Host "    Completed: $($health.tasks.stats.completed)" -ForegroundColor Cyan
    Write-Host "    Failed: $($health.tasks.stats.failed)" -ForegroundColor Cyan
    Write-Host "    Active: $($health.tasks.active)" -ForegroundColor Cyan
    
    if ($health.tasks.stats.total -lt 1) {
        throw "No tasks recorded in stats"
    }
}

# 测试结果总结
Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "  测试结果总结" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "通过: $testsPassed" -ForegroundColor Green
Write-Host "失败: $testsFailed" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })
Write-Host "总计: $($testsPassed + $testsFailed)" -ForegroundColor White

if ($testsFailed -eq 0) {
    Write-Host ""
    Write-Host "所有测试通过！系统功能完全正常。" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "部分测试失败，请检查上述错误。" -ForegroundColor Yellow
    exit 1
}
