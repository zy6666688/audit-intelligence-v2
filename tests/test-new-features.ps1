# 测试新增功能
Write-Host "====================================="
Write-Host "  测试 ComfyUI 风格新功能"
Write-Host "====================================="

$baseUrl = "http://localhost:3000"
$passed = 0
$failed = 0

# Test 1: 节点库查询
Write-Host "`n[1] Testing Node Library..."
try {
    $library = Invoke-RestMethod -Uri "$baseUrl/api/node-library"
    Write-Host "  Categories: $($library.data.PSObject.Properties.Count)"
    Write-Host "  Total nodes: $($library.totalNodes)"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 2: 保存工作流
Write-Host "`n[2] Testing Save Workflow..."
try {
    $workflow = @{
        name = "测试工作流"
        description = "自动化测试创建"
        nodes = @(
            @{
                id = "node-1"
                type = "simple_add"
                position = @{ x = 100; y = 100 }
                data = @{ title = "加法节点" }
            },
            @{
                id = "node-2"
                type = "audit.voucher_analysis"
                position = @{ x = 300; y = 100 }
                data = @{ title = "凭证分析" }
            }
        )
        connections = @(
            @{
                id = "conn-1"
                from = "node-1"
                to = "node-2"
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $result = Invoke-RestMethod -Uri "$baseUrl/api/workflows" -Method Post -Body $workflow -ContentType "application/json"
    Write-Host "  Workflow ID: $($result.data.id)"
    Write-Host "  Name: $($result.data.name)"
    Write-Host "  Nodes: $($result.data.nodes.Count)"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
    $script:workflowId = $result.data.id
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 3: 获取工作流列表
Write-Host "`n[3] Testing Get Workflow List..."
try {
    $list = Invoke-RestMethod -Uri "$baseUrl/api/workflows"
    Write-Host "  Workflows count: $($list.count)"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 4: 获取工作流详情
Write-Host "`n[4] Testing Get Workflow Detail..."
try {
    if ($script:workflowId) {
        $detail = Invoke-RestMethod -Uri "$baseUrl/api/workflows/$($script:workflowId)"
        Write-Host "  Workflow name: $($detail.data.name)"
        Write-Host "  Nodes: $($detail.data.nodes.Count)"
        Write-Host "  PASSED" -ForegroundColor Green
        $passed++
    } else {
        throw "No workflow ID"
    }
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 5: 测试业务节点
Write-Host "`n[5] Testing Business Node (Voucher Analysis)..."
try {
    $vouchers = @(
        @{
            voucherNo = "V001"
            date = "2025-12-01"
            description = "测试凭证"
            debitAmount = 100.50
            creditAmount = 100.50
            attachments = @("file1.pdf")
        },
        @{
            voucherNo = "V002"
            date = "2025-12-01"
            description = "错误凭证"
            debitAmount = 200.00
            creditAmount = 150.00
            attachments = @()
        }
    )
    
    $body = @{
        inputs = @{
            vouchers = $vouchers
        }
        config = @{
            checkBalance = $true
            checkAttachments = $true
        }
    } | ConvertTo-Json -Depth 10
    
    $result = Invoke-RestMethod -Uri "$baseUrl/api/nodes/audit.voucher_analysis/execute" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  Total: $($result.data.totalCount)"
    Write-Host "  Valid: $($result.data.validCount)"
    Write-Host "  Invalid: $($result.data.invalidCount)"
    Write-Host "  Risk: $($result.data.riskLevel)"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 6: 任务取消
Write-Host "`n[6] Testing Task Cancellation..."
try {
    # 提交一个任务
    $taskBody = '{"nodeId":"test-cancel","type":"simple_add","config":{},"inputs":{"a":1,"b":2}}'
    $submitRes = Invoke-RestMethod -Uri "$baseUrl/api/engine/dispatch" -Method Post -Body $taskBody -ContentType "application/json"
    $taskId = $submitRes.data.taskId
    Write-Host "  Task submitted: $taskId"
    
    # 取消任务
    $cancelRes = Invoke-RestMethod -Uri "$baseUrl/api/engine/tasks/$taskId/cancel" -Method Post
    Write-Host "  Cancel status: $($cancelRes.data.status)"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 7: 删除工作流
Write-Host "`n[7] Testing Delete Workflow..."
try {
    if ($script:workflowId) {
        Invoke-RestMethod -Uri "$baseUrl/api/workflows/$($script:workflowId)" -Method Delete
        Write-Host "  Workflow deleted: $($script:workflowId)"
        Write-Host "  PASSED" -ForegroundColor Green
        $passed++
    } else {
        throw "No workflow ID"
    }
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Summary
Write-Host "`n====================================="
Write-Host "  Test Summary"
Write-Host "====================================="
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "Total: $($passed + $failed)"

if ($failed -eq 0) {
    Write-Host ""
    Write-Host "All new features working perfectly!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "Some tests failed." -ForegroundColor Yellow
    exit 1
}
