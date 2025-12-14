# 测试小程序迁移后的API功能
# 创建时间: 2025-12-01

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   小程序迁移功能测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"
$testResults = @()

function Test-API {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body = $null
    )
    
    Write-Host "Testing: $Name..." -NoNewline
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = "application/json"
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        
        Write-Host " ✅ PASS" -ForegroundColor Green
        $script:testResults += @{
            Name = $Name
            Status = "PASS"
            Response = $response
        }
        
        return $response
        
    } catch {
        Write-Host " ❌ FAIL" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:testResults += @{
            Name = $Name
            Status = "FAIL"
            Error = $_.Exception.Message
        }
        return $null
    }
}

Write-Host "📋 测试1: 健康检查" -ForegroundColor Yellow
Test-API -Name "Health Check" -Method "GET" -Url "$baseUrl/health"
Write-Host ""

Write-Host "📋 测试2: 创建测试工作流" -ForegroundColor Yellow
$workflow = @{
    name = "测试工作流"
    description = "小程序迁移测试工作流"
    nodes = @(
        @{
            id = "node1"
            type = "simple_add"
            data = @{
                title = "加法节点"
                config = @{
                    a = 10
                    b = 20
                }
            }
        }
    )
    connections = @()
}

$createdWorkflow = Test-API -Name "Create Workflow" -Method "POST" -Url "$baseUrl/api/workflows" -Body $workflow

if ($createdWorkflow) {
    Write-Host "  工作流ID: $($createdWorkflow.data.id)" -ForegroundColor Cyan
}
Write-Host ""

Write-Host "📋 测试3: 获取工作流列表" -ForegroundColor Yellow
$workflowList = Test-API -Name "Get Workflow List" -Method "GET" -Url "$baseUrl/api/workflows"

if ($workflowList) {
    Write-Host "  工作流数量: $($workflowList.count)" -ForegroundColor Cyan
    foreach ($wf in $workflowList.data) {
        Write-Host "  - $($wf.name) (ID: $($wf.id))" -ForegroundColor Gray
    }
}
Write-Host ""

if ($createdWorkflow) {
    Write-Host "📋 测试4: 获取工作流详情" -ForegroundColor Yellow
    $workflowDetail = Test-API -Name "Get Workflow Detail" -Method "GET" -Url "$baseUrl/api/workflows/$($createdWorkflow.data.id)"
    
    if ($workflowDetail) {
        Write-Host "  名称: $($workflowDetail.data.name)" -ForegroundColor Cyan
        Write-Host "  节点数: $($workflowDetail.data.nodes.Count)" -ForegroundColor Cyan
    }
    Write-Host ""
    
    Write-Host "📋 测试5: 执行工作流" -ForegroundColor Yellow
    $execution = Test-API -Name "Execute Workflow" -Method "POST" -Url "$baseUrl/api/execute/workflow/$($createdWorkflow.data.id)" -Body @{
        inputs = @{}
        config = @{}
    }
    
    if ($execution) {
        Write-Host "  任务ID: $($execution.data.taskId)" -ForegroundColor Cyan
        Write-Host "  状态: $($execution.data.status)" -ForegroundColor Cyan
        
        # 等待执行完成
        Write-Host "  等待执行..." -NoNewline
        Start-Sleep -Seconds 2
        Write-Host " 完成" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "📋 测试6: 查询任务状态" -ForegroundColor Yellow
        $taskStatus = Test-API -Name "Get Task Status" -Method "GET" -Url "$baseUrl/api/engine/tasks/$($execution.data.taskId)"
        
        if ($taskStatus) {
            Write-Host "  状态: $($taskStatus.data.status)" -ForegroundColor Cyan
            Write-Host "  进度: $($taskStatus.data.progress)%" -ForegroundColor Cyan
        }
    }
    Write-Host ""
}

Write-Host "📋 测试7: 获取执行历史" -ForegroundColor Yellow
$history = Test-API -Name "Get Execution History" -Method "GET" -Url "$baseUrl/api/execute/history?limit=10"

if ($history) {
    Write-Host "  历史记录数: $($history.pagination.total)" -ForegroundColor Cyan
    foreach ($task in $history.data | Select-Object -First 3) {
        Write-Host "  - 工作流: $($task.workflowName) | 状态: $($task.status) | 时长: $($task.duration)ms" -ForegroundColor Gray
    }
}
Write-Host ""

Write-Host "📋 测试8: 获取节点库" -ForegroundColor Yellow
$nodeLibrary = Test-API -Name "Get Node Library" -Method "GET" -Url "$baseUrl/api/node-library"

if ($nodeLibrary) {
    Write-Host "  分类数: $($nodeLibrary.data.categories.Count)" -ForegroundColor Cyan
    foreach ($category in $nodeLibrary.data.categories) {
        Write-Host "  - $($category.id): $($category.nodes.Count) 个节点" -ForegroundColor Gray
    }
}
Write-Host ""

# 测试清理
if ($createdWorkflow) {
    Write-Host "📋 测试9: 删除测试工作流" -ForegroundColor Yellow
    Test-API -Name "Delete Workflow" -Method "DELETE" -Url "$baseUrl/api/workflows/$($createdWorkflow.data.id)"
    Write-Host ""
}

# 汇总结果
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   测试结果汇总" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$totalCount = $testResults.Count

Write-Host "总测试数: $totalCount" -ForegroundColor White
Write-Host "通过: $passCount" -ForegroundColor Green
Write-Host "失败: $failCount" -ForegroundColor Red
Write-Host "通过率: $([math]::Round($passCount / $totalCount * 100, 2))%" -ForegroundColor Cyan
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "✅ 所有测试通过！小程序迁移功能正常" -ForegroundColor Green
} else {
    Write-Host "⚠️ 部分测试失败，请检查失败项" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "失败的测试:" -ForegroundColor Red
    foreach ($result in $testResults | Where-Object { $_.Status -eq "FAIL" }) {
        Write-Host "  - $($result.Name): $($result.Error)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
