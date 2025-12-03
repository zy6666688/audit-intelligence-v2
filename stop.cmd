@echo off
chcp 65001 > nul
title 审计数智析 - 停止服务

echo.
echo ========================================
echo   审计数智析 - 停止服务
echo ========================================
echo.

echo 正在停止所有服务...
docker-compose -p audit-engine down

if %errorlevel% equ 0 (
    echo.
    echo ✅ 所有服务已停止
) else (
    echo.
    echo ❌ 停止服务时出现错误
)

echo.
echo ========================================
pause
