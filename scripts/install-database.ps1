# 数据库快速安装脚本
# 用于一键安装和配置数据库

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  审计数智析 - 数据库快速安装脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查Node.js
Write-Host "[1/8] 检查Node.js..." -ForegroundColor Yellow
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 未检测到Node.js，请先安装Node.js 18+" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "✓ Node.js版本: $nodeVersion" -ForegroundColor Green

# 检查PostgreSQL
Write-Host ""
Write-Host "[2/8] 检查PostgreSQL..." -ForegroundColor Yellow
if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "警告: 未检测到PostgreSQL" -ForegroundColor Yellow
    Write-Host "请访问 https://www.postgresql.org/download/ 下载安装" -ForegroundColor Yellow
    $continue = Read-Host "是否已安装但未加入PATH? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
} else {
    Write-Host "✓ PostgreSQL已安装" -ForegroundColor Green
}

# 检查Redis
Write-Host ""
Write-Host "[3/8] 检查Redis..." -ForegroundColor Yellow
if (!(Get-Command redis-server -ErrorAction SilentlyContinue)) {
    Write-Host "警告: 未检测到Redis" -ForegroundColor Yellow
    Write-Host "将使用临时内存存储，建议安装Redis以获得更好性能" -ForegroundColor Yellow
} else {
    Write-Host "✓ Redis已安装" -ForegroundColor Green
}

# 进入backend目录
Write-Host ""
Write-Host "[4/8] 进入backend目录..." -ForegroundColor Yellow
Set-Location packages\backend
Write-Host "✓ 当前目录: $(Get-Location)" -ForegroundColor Green

# 检查.env文件
Write-Host ""
Write-Host "[5/8] 配置环境变量..." -ForegroundColor Yellow
if (!(Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✓ 已创建.env文件" -ForegroundColor Green
        Write-Host "请编辑.env文件，配置数据库连接信息" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "默认配置:" -ForegroundColor Cyan
        Write-Host "DATABASE_URL=postgresql://postgres:password@localhost:5432/audit_engine" -ForegroundColor Cyan
        Write-Host "REDIS_URL=redis://localhost:6379" -ForegroundColor Cyan
        Write-Host ""
        $editNow = Read-Host "是否现在编辑.env文件? (y/n)"
        if ($editNow -eq 'y') {
            notepad .env
            Write-Host "请保存后按任意键继续..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    } else {
        Write-Host "错误: 找不到.env.example文件" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ .env文件已存在" -ForegroundColor Green
}

# 安装依赖
Write-Host ""
Write-Host "[6/8] 安装依赖包..." -ForegroundColor Yellow
Write-Host "这可能需要几分钟时间..." -ForegroundColor Gray
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 依赖安装失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 依赖安装完成" -ForegroundColor Green

# 生成Prisma Client
Write-Host ""
Write-Host "[7/8] 生成Prisma Client..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: Prisma Client生成失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Prisma Client生成完成" -ForegroundColor Green

# 推送Schema到数据库
Write-Host ""
Write-Host "[8/8] 初始化数据库..." -ForegroundColor Yellow
Write-Host "这将创建数据库表结构..." -ForegroundColor Gray
npm run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 数据库初始化失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能的原因:" -ForegroundColor Yellow
    Write-Host "1. PostgreSQL未启动" -ForegroundColor Yellow
    Write-Host "2. 数据库连接信息错误(.env文件)" -ForegroundColor Yellow
    Write-Host "3. 数据库audit_engine不存在" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "请检查后重新运行此脚本" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ 数据库初始化完成" -ForegroundColor Green

# 询问是否运行种子数据
Write-Host ""
$runSeed = Read-Host "是否创建测试账号和示例数据? (y/n)"
if ($runSeed -eq 'y') {
    Write-Host ""
    Write-Host "创建种子数据..." -ForegroundColor Yellow
    npm run prisma:seed
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 种子数据创建完成" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  测试账号" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "管理员: admin@audit.com / admin123" -ForegroundColor Green
        Write-Host "审计员: auditor@audit.com / user123" -ForegroundColor Green
    }
}

# 完成
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ 数据库安装完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "1. 启动服务器: npm run dev" -ForegroundColor White
Write-Host "2. 访问API: http://localhost:3000" -ForegroundColor White
Write-Host "3. 打开Prisma Studio: npm run prisma:studio" -ForegroundColor White
Write-Host ""

# 询问是否立即启动
$startNow = Read-Host "是否立即启动开发服务器? (y/n)"
if ($startNow -eq 'y') {
    Write-Host ""
    Write-Host "正在启动服务器..." -ForegroundColor Yellow
    npm run dev
}

# 返回根目录
Set-Location ..\..
