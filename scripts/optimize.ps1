# 审计底稿引擎 - 自动优化脚本
# 执行生产就绪优化

param(
    [switch]$SecurityOnly,
    [switch]$PerformanceOnly,
    [switch]$All
)

Write-Host "`n🔧 开始系统优化..." -ForegroundColor Cyan

if ($SecurityOnly -or $All) {
    Write-Host "`n=== 安全性优化 ===" -ForegroundColor Yellow
    
    # 1. 生成强密码
    Write-Host "1. 生成新的安全密码..." -ForegroundColor Green
    $dbPassword = -join ((65..90) + (97..122) + (48..57) + (33,35,37,64) | Get-Random -Count 32 | % {[char]$_})
    $redisPassword = -join ((65..90) + (97..122) + (48..57) + (33,35,37,64) | Get-Random -Count 32 | % {[char]$_})
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) + (33,35,37,64) | Get-Random -Count 64 | % {[char]$_})
    
    Write-Host "  ✓ 已生成数据库密码" -ForegroundColor Green
    Write-Host "  ✓ 已生成Redis密码" -ForegroundColor Green
    Write-Host "  ✓ 已生成JWT密钥" -ForegroundColor Green
    
    # 备份原.env
    Copy-Item .env ".env.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "  ✓ 已备份原配置文件" -ForegroundColor Green
    
    # 更新.env
    $envContent = Get-Content .env
    $envContent = $envContent -replace 'DB_PASSWORD=.*', "DB_PASSWORD=$dbPassword"
    $envContent = $envContent -replace 'REDIS_PASSWORD=.*', "REDIS_PASSWORD=$redisPassword"
    $envContent = $envContent -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret"
    $envContent | Set-Content .env
    
    Write-Host "  ✓ 已更新配置文件" -ForegroundColor Green
    
    Write-Host "`n⚠️  重要提示：请保存新密码到安全位置！" -ForegroundColor Red
    Write-Host "数据库密码: $dbPassword" -ForegroundColor Yellow
    Write-Host "Redis密码: $redisPassword" -ForegroundColor Yellow
    Write-Host "JWT密钥: $jwtSecret" -ForegroundColor Yellow
}

if ($PerformanceOnly -or $All) {
    Write-Host "`n=== 性能优化 ===" -ForegroundColor Yellow
    
    # 2. 优化Docker配置
    Write-Host "2. 优化Docker配置..." -ForegroundColor Green
    
    # 检查是否有docker-compose.prod.yml
    if (!(Test-Path "docker-compose.prod.yml")) {
        Write-Host "  创建生产环境配置..." -ForegroundColor Gray
        
        # 这里可以添加生产优化的docker-compose配置
        @"
version: '3.8'

# 生产环境优化配置
# 继承 docker-compose.yml 并添加优化

services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: always
    
  frontend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    restart: always
    
  postgres:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    command: postgres -c max_connections=200 -c shared_buffers=256MB
    restart: always
    
  redis:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    command: redis-server --requirepass \${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: always
"@ | Set-Content "docker-compose.prod.yml"
        
        Write-Host "  ✓ 已创建生产环境配置" -ForegroundColor Green
    }
    
    # 3. 清理Docker缓存
    Write-Host "3. 清理Docker缓存..." -ForegroundColor Green
    docker system prune -f
    Write-Host "  ✓ Docker缓存已清理" -ForegroundColor Green
}

if ($All) {
    Write-Host "`n=== 配置数据库备份 ===" -ForegroundColor Yellow
    
    # 4. 设置自动备份
    Write-Host "4. 配置数据库自动备份..." -ForegroundColor Green
    
    if (!(Test-Path "backups")) {
        New-Item -ItemType Directory -Path "backups"
        Write-Host "  ✓ 已创建备份目录" -ForegroundColor Green
    }
    
    # 创建备份脚本
    @"
# 数据库备份脚本
`$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker-compose -p audit-engine exec -T postgres pg_dump -U postgres audit_engine > "backups/backup_`$timestamp.sql"

# 保留最近30天的备份
Get-ChildItem "backups" -Filter "backup_*.sql" | Where-Object {`$_.LastWriteTime -lt (Get-Date).AddDays(-30)} | Remove-Item

Write-Host "备份完成: backup_`$timestamp.sql"
"@ | Set-Content "backup.ps1"
    
    Write-Host "  ✓ 已创建备份脚本" -ForegroundColor Green
    Write-Host "  提示: 可使用任务计划程序设置定时备份" -ForegroundColor Gray
}

Write-Host "`n=== 应用优化 ===" -ForegroundColor Yellow

# 重启服务应用新配置
if ($SecurityOnly -or $All) {
    Write-Host "重启服务以应用新配置..." -ForegroundColor Green
    docker-compose -p audit-engine down
    Start-Sleep -Seconds 3
    
    if (Test-Path "docker-compose.prod.yml") {
        docker-compose -p audit-engine -f docker-compose.yml -f docker-compose.prod.yml up -d
    } else {
        docker-compose -p audit-engine up -d
    }
    
    Write-Host "  ✓ 服务已重启" -ForegroundColor Green
}

Write-Host "`n✅ 优化完成！" -ForegroundColor Green
Write-Host "`n运行 .\health-check.ps1 检查系统状态" -ForegroundColor Cyan
