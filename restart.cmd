@echo off
chcp 65001 > nul
title 审计数智析 - 重启服务

echo.
echo ========================================
echo   审计数智析 - 重启服务
echo ========================================
echo.

echo [1/3] 停止现有服务...
docker-compose -p audit-engine down
echo.

echo [2/3] 启动服务...
docker-compose -p audit-engine up -d
echo.

echo [3/3] 等待服务就绪（40秒）...
timeout /t 40 /nobreak > nul
echo.

echo 检查服务状态...
docker-compose -p audit-engine ps
echo.

echo ========================================
echo   ✅ 重启完成！
echo ========================================
echo.
echo 📊 服务访问地址:
echo   🌐 前端: http://localhost:8080
echo   🔌 后端: http://localhost:3002
echo.
pause
