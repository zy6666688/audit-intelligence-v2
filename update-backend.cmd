@echo off
chcp 65001 > nul
title 审计数智析 - 更新后端

echo.
echo ========================================
echo   更新后端服务
echo ========================================
echo.

echo [1/3] 重新构建后端镜像...
docker-compose -p audit-engine build backend
if %errorlevel% neq 0 (
    echo ❌ 构建失败！
    pause
    exit /b 1
)
echo ✅ 构建成功
echo.

echo [2/3] 重启后端服务...
docker-compose -p audit-engine up -d backend
echo ✅ 服务已重启
echo.

echo [3/3] 等待服务启动（20秒）...
timeout /t 20 /nobreak > nul
echo.

echo ========================================
echo   测试语言切换功能
echo ========================================
echo.

echo 测试中文...
powershell -Command "$r = Invoke-WebRequest -Uri 'http://localhost:3002/api/nodes?lang=zh' -UseBasicParsing; $d = ($r.Content | ConvertFrom-Json); Write-Host '节点数:' $d.count '语言:' $d.lang '第一个节点:' $d.data[0].label"

echo.
echo 测试英文...
powershell -Command "$r = Invoke-WebRequest -Uri 'http://localhost:3002/api/nodes?lang=en' -UseBasicParsing; $d = ($r.Content | ConvertFrom-Json); Write-Host '节点数:' $d.count '语言:' $d.lang '第一个节点:' $d.data[0].label"

echo.
echo ========================================
echo   更新完成！
echo ========================================
pause
