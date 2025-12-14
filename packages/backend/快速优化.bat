@echo off
chcp 65001 >nul
echo ========================================
echo   审计数智析 - 数据库优化执行脚本
echo ========================================
echo.

REM 检查PostgreSQL
echo [1/5] 检查PostgreSQL...
where psql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 未检测到PostgreSQL
    echo.
    echo 请先安装PostgreSQL:
    echo 1. 使用Chocolatey: choco install postgresql
    echo 2. 或访问: https://www.postgresql.org/download/
    echo.
    pause
    exit /b 1
)
echo ✓ PostgreSQL已安装

REM 检查数据库是否存在
echo.
echo [2/5] 检查数据库...
psql -U postgres -lqt | findstr audit_engine >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️ 数据库不存在，正在创建...
    psql -U postgres -c "CREATE DATABASE audit_engine;"
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ 数据库创建失败
        echo 请检查PostgreSQL是否运行，密码是否正确
        pause
        exit /b 1
    )
    echo ✓ 数据库创建成功
) else (
    echo ✓ 数据库已存在
)

REM 检查.env文件
echo.
echo [3/5] 检查配置文件...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo ✓ .env文件已创建
        echo ⚠️ 请编辑.env文件，配置数据库连接信息
        echo.
        pause
    ) else (
        echo ❌ 找不到.env.example文件
        pause
        exit /b 1
    )
) else (
    echo ✓ .env文件已存在
)

REM 推送Schema
echo.
echo [4/5] 初始化数据库Schema...
call npm run db:push
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Schema推送失败
    echo 请检查.env中的DATABASE_URL配置
    pause
    exit /b 1
)
echo ✓ Schema推送成功

REM 执行优化SQL
echo.
echo [5/5] 执行优化SQL...
psql -U postgres -d audit_engine -f prisma\migrations\optimization_indexes.sql
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 优化SQL执行失败
    pause
    exit /b 1
)
echo ✓ 优化SQL执行成功

REM 更新统计信息
echo.
echo 更新数据库统计信息...
psql -U postgres -d audit_engine -c "ANALYZE;"

REM 完成
echo.
echo ========================================
echo   ✓ 优化完成！
echo ========================================
echo.
echo 已完成:
echo ✓ 16个性能索引
echo ✓ 3个物化视图
echo ✓ 统计信息更新
echo.
echo 预期性能提升:
echo - 查询速度: 3-10倍 ⬆️
echo - 统计报表: 100倍 ⬆️
echo.
echo 下一步:
echo 1. 运行 npm run dev 启动服务
echo 2. 访问 http://localhost:3000
echo 3. (可选) 运行 npm run prisma:seed 创建测试数据
echo.
pause
