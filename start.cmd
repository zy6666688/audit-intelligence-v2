@echo off
chcp 65001 > nul
title 审计数智析 - 一键启动

echo.
echo ========================================
echo   审计数智析 - 一键启动脚本
echo ========================================
echo.

:: 检查Docker是否运行
echo [1/4] 检查Docker服务...
docker info > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker未运行，正在启动Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo ⏳ 等待Docker启动（60秒）...
    timeout /t 60 /nobreak > nul
) else (
    echo ✅ Docker已运行
)
echo.

:: 启动所有服务
echo [2/4] 启动所有服务...
docker-compose -p audit-engine up -d
if %errorlevel% neq 0 (
    echo ❌ 服务启动失败！
    pause
    exit /b 1
)
echo ✅ 服务启动成功
echo.

:: 等待服务就绪
echo [3/4] 等待服务就绪（40秒）...
timeout /t 40 /nobreak > nul
echo.

:: 检查服务状态
echo [4/4] 检查服务状态...
docker-compose -p audit-engine ps
echo.

:: 显示访问地址
echo ========================================
echo   🎉 启动完成！
echo ========================================
echo.
echo 📊 服务访问地址:
echo.
echo   🌐 前端页面:  http://localhost:8080
echo   🔌 后端API:   http://localhost:3002
echo   📚 API文档:   http://localhost:3002/api/nodes
echo.
echo ========================================
echo.
echo 按任意键在浏览器中打开前端页面...
pause > nul

:: 打开浏览器
start http://localhost:8080

echo.
echo 提示: 关闭此窗口不会停止服务
echo 如需停止服务，请运行: stop.cmd
echo.
pause
