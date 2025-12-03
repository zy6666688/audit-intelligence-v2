# 审计数智析 - 完整诊断脚本

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  审计数智析 - 功能诊断" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$backendUrl = "http://localhost:3002"
$frontendUrl = "http://localhost:8080"

# 1. 检查基础连接
Write-Host "1. 检查基础服务..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✅ 后端健康检查通过" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 后端健康检查失败: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✅ 前端服务正常" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 前端服务失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. 检查节点API
Write-Host "`n2. 检查节点API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/nodes" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    Write-Host "  ✅ 节点API正常 - 已注册 $($data.data.Count) 个节点" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 节点API失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. 检查认证API
Write-Host "`n3. 检查认证API..." -ForegroundColor Yellow
try {
    # 测试注册接口（应该返回400或相应错误，但能连接）
    $response = Invoke-WebRequest -Uri "$backendUrl/api/auth/register" -Method POST -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  ✅ 认证API端点可访问（缺少参数是正常的）" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ 认证API状态: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}

# 4. 检查文件上传API
Write-Host "`n4. 检查文件上传API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/files/upload" -Method POST -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
} catch {
    if ($_.Exception.Message -match "No authorization|401") {
        Write-Host "  ✅ 文件上传API端点存在（需要认证是正常的）" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ 文件上传API状态: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# 5. 检查CORS配置
Write-Host "`n5. 检查CORS配置..." -ForegroundColor Yellow
try {
    $headers = @{
        "Origin" = "http://localhost:8080"
    }
    $response = Invoke-WebRequest -Uri "$backendUrl/api/nodes" -Headers $headers -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    
    if ($response.Headers.'Access-Control-Allow-Origin') {
        Write-Host "  ✅ CORS已配置: $($response.Headers.'Access-Control-Allow-Origin')" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ CORS头不存在" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ CORS检查失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. 检查工作流API
Write-Host "`n6. 检查工作流API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/workflows" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
} catch {
    if ($_.Exception.Message -match "No authorization|401") {
        Write-Host "  ✅ 工作流API端点存在（需要认证）" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ 工作流API状态: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# 7. 检查项目API
Write-Host "`n7. 检查项目API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/projects" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
} catch {
    if ($_.Exception.Message -match "No authorization|401") {
        Write-Host "  ✅ 项目API端点存在（需要认证）" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ 项目API状态: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# 8. 检查后端日志错误
Write-Host "`n8. 检查最近的后端错误..." -ForegroundColor Yellow
$errors = docker-compose -p audit-engine logs backend --tail=100 2>&1 | Select-String "error|Error|ERROR|ECONNREFUSED|CORS" | Select-Object -First 5

if ($errors) {
    Write-Host "  ⚠️ 发现以下错误:" -ForegroundColor Yellow
    $errors | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "  ✅ 最近100行日志中无明显错误" -ForegroundColor Green
}

# 9. 列出所有可用的API端点
Write-Host "`n9. 可用的API端点:" -ForegroundColor Yellow
Write-Host "  认证相关:" -ForegroundColor Cyan
Write-Host "    POST $backendUrl/api/auth/register"
Write-Host "    POST $backendUrl/api/auth/login"
Write-Host "    POST $backendUrl/api/auth/logout"
Write-Host ""
Write-Host "  节点相关:" -ForegroundColor Cyan  
Write-Host "    GET  $backendUrl/api/nodes"
Write-Host "    GET  $backendUrl/api/node-library"
Write-Host "    POST $backendUrl/api/nodes/:type/execute"
Write-Host ""
Write-Host "  工作流相关:" -ForegroundColor Cyan
Write-Host "    GET  $backendUrl/api/workflows"
Write-Host "    POST $backendUrl/api/workflows"
Write-Host "    PUT  $backendUrl/api/workflows/:id"
Write-Host ""
Write-Host "  文件相关:" -ForegroundColor Cyan
Write-Host "    POST $backendUrl/api/files/upload"
Write-Host "    GET  $backendUrl/api/files/:id"
Write-Host ""
Write-Host "  项目相关:" -ForegroundColor Cyan
Write-Host "    GET  $backendUrl/api/projects"
Write-Host "    POST $backendUrl/api/projects"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  诊断完成！" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "💡 常见问题解决方案:" -ForegroundColor Green
Write-Host ""
Write-Host "1. 节点无法编辑:" -ForegroundColor Yellow
Write-Host "   - 检查是否已登录（需要认证token）"
Write-Host "   - 检查浏览器控制台是否有CORS错误"
Write-Host "   - 尝试清除浏览器缓存并刷新"
Write-Host ""
Write-Host "2. 文件无法上传:" -ForegroundColor Yellow
Write-Host "   - 确保已登录系统"
Write-Host "   - 检查文件大小（限制50MB）"
Write-Host "   - 检查浏览器控制台Network标签的错误"
Write-Host ""
Write-Host "3. AI分析无效:" -ForegroundColor Yellow
Write-Host "   - AI分析功能可能需要额外配置"
Write-Host "   - 检查后端是否有AI相关的环境变量"
Write-Host "   - 查看后端日志中AI相关的错误"
Write-Host ""

pause
