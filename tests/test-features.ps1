# Comprehensive Feature Test
Write-Host "====================================="
Write-Host "  Comprehensive Feature Test"
Write-Host "====================================="

$baseUrl = "http://localhost:3000"
$passed = 0
$failed = 0

# Test 1: Health Check
Write-Host "`n[1] Testing Health Check..."
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health"
    Write-Host "  Status: $($health.status)"
    Write-Host "  Uptime: $($health.uptime)"
    Write-Host "  Memory: $($health.memory.heapUsed)"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 2: List Nodes
Write-Host "`n[2] Testing List Nodes..."
try {
    $nodes = Invoke-RestMethod -Uri "$baseUrl/api/nodes"
    Write-Host "  Nodes found: $($nodes.data.Count)"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 3: Execute Node Directly
Write-Host "`n[3] Testing Direct Node Execution..."
try {
    $body = '{"inputs":{"a":10,"b":20},"config":{}}'
    $result = Invoke-RestMethod -Uri "$baseUrl/api/nodes/simple_add/execute" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  Result: $($result.data.sum)"
    Write-Host "  Duration: $($result.metadata.duration)ms"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 4: Submit Task
Write-Host "`n[4] Testing Engine API - Submit Task..."
try {
    $body = '{"nodeId":"test-1","type":"simple_multiply","config":{},"inputs":{"a":5,"b":6}}'
    $submit = Invoke-RestMethod -Uri "$baseUrl/api/engine/dispatch" -Method Post -Body $body -ContentType "application/json"
    $taskId = $submit.data.taskId
    Write-Host "  TaskID: $taskId"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
    $script:lastTaskId = $taskId
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 5: Poll Task Status
Write-Host "`n[5] Testing Engine API - Poll Status..."
try {
    if ($script:lastTaskId) {
        Start-Sleep -Seconds 2
        $status = Invoke-RestMethod -Uri "$baseUrl/api/engine/tasks/$($script:lastTaskId)"
        Write-Host "  Status: $($status.data.status)"
        Write-Host "  Progress: $($status.data.progress)%"
        if ($status.data.result) {
            Write-Host "  Result: $($status.data.result.product)"
        }
        Write-Host "  PASSED" -ForegroundColor Green
        $passed++
    } else {
        throw "No taskId available"
    }
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed++
}

# Test 6: Final Health Check
Write-Host "`n[6] Testing Final Health Check with Stats..."
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health"
    Write-Host "  Total tasks: $($health.tasks.stats.total)"
    Write-Host "  Completed: $($health.tasks.stats.completed)"
    Write-Host "  Active: $($health.tasks.active)"
    Write-Host "  PASSED" -ForegroundColor Green
    $passed++
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
    Write-Host "`nAll tests passed! System is fully functional." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSome tests failed. Please check errors above." -ForegroundColor Yellow
    exit 1
}
