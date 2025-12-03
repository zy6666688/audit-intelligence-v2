@echo off
REM 审计底稿引擎 - Windows快速启动脚本
REM 版本: v0.9.0-beta

echo ========================================
echo 🚀 审计底稿引擎启动脚本
echo ========================================
echo.

REM 检查Docker是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未检测到 Docker
    echo 请先安装 Docker Desktop
    echo 下载地址: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未检测到 Docker Compose
    echo 请确保 Docker Desktop 已正确安装
    pause
    exit /b 1
)

echo ✅ Docker 环境检查通过
echo.

REM 检查.env文件
if not exist .env (
    echo ⚠️ 未找到.env文件，将从模板创建...
    copy .env.example .env
    echo 📝 请编辑.env文件并配置必要的环境变量
    echo 特别注意修改以下配置:
    echo   - DB_PASSWORD 数据库密码
    echo   - JWT_SECRET JWT密钥
    echo   - REDIS_PASSWORD Redis密码
    echo.
    notepad .env
    echo.
    set /p confirm="是否已完成配置? (Y/N): "
    if /i not "%confirm%"=="Y" (
        echo ⏸️ 请先配置.env文件，然后重新运行此脚本
        pause
        exit /b 1
    )
)

echo ✅ 环境变量配置检查通过
echo.

REM 选择部署模式
echo 请选择部署模式:
echo   1) 开发模式 development
echo   2) 生产模式 production
echo.
set /p mode="请输入选择 (1/2): "

if "%mode%"=="2" (
    set NODE_ENV=production
    echo 🏭 使用生产模式
) else (
    set NODE_ENV=development
    echo 🔧 使用开发模式
)
echo.

REM 构建并启动服务
echo 📦 构建Docker镜像...
docker-compose build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo.
echo 🚀 启动服务...
docker-compose up -d
if errorlevel 1 (
    echo ❌ 启动失败
    pause
    exit /b 1
)

echo.
echo ⏳ 等待服务启动...
timeout /t 15 /nobreak >nul

REM 健康检查
echo.
echo 🏥 健康检查...

docker-compose exec -T postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo ❌ 数据库: 异常
) else (
    echo ✅ 数据库: 正常
)

docker-compose exec -T redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ❌ Redis: 异常
) else (
    echo ✅ Redis: 正常
)

curl -s http://localhost:3000/health | findstr "healthy" >nul 2>&1
if errorlevel 1 (
    echo ❌ 后端服务: 异常
    echo 📝 查看后端日志:
    docker-compose logs --tail=20 backend
) else (
    echo ✅ 后端服务: 正常
)

curl -s http://localhost:80/ | findstr "html" >nul 2>&1
if errorlevel 1 (
    echo ⚠️ 前端服务: 可能需要更长时间启动
) else (
    echo ✅ 前端服务: 正常
)

echo.
echo ========================================
echo 🎉 启动完成！
echo ========================================
echo.
echo 📍 访问地址:
echo   前端: http://localhost
echo   后端API: http://localhost:3000/api
echo   API文档: http://localhost:3000/
echo.
echo 👤 默认账号:
echo   用户名: admin
echo   密码: admin123
echo.
echo 📝 常用命令:
echo   查看日志: docker-compose logs -f
echo   停止服务: docker-compose down
echo   重启服务: docker-compose restart
echo   查看状态: docker-compose ps
echo.
echo 📚 更多帮助请查看: DEPLOYMENT_GUIDE.md
echo ========================================
echo.

REM 询问是否打开浏览器
set /p open="是否打开浏览器访问系统? (Y/N): "
if /i "%open%"=="Y" (
    start http://localhost
)

pause
