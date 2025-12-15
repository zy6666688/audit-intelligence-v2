# Docker 部署指南

> **Version**: 1.0  
> **Last Updated**: 2025-12-11  
> **Status**: ✅ Production Ready

---

## 🎯 快速开始

### 前提条件
- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

### 一键启动

#### Linux/Mac
```bash
chmod +x docker-start.sh
./docker-start.sh
```

#### Windows
```cmd
docker-start.bat
```

---

## 📋 详细步骤

### 1. 准备环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置文件
nano .env  # 或使用其他编辑器
```

**⚠️ 必须修改的配置**:
```bash
# 生成强随机密钥
JWT_SECRET=$(openssl rand -base64 32)

# 或使用 Python
JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
```

### 2. 构建镜像

```bash
# 构建所有服务
docker-compose build

# 仅构建特定服务
docker-compose build backend
docker-compose build frontend
```

### 3. 启动服务

```bash
# 后台启动
docker-compose up -d

# 前台启动（查看日志）
docker-compose up

# 启动特定服务
docker-compose up -d backend frontend
```

### 4. 验证部署

```bash
# 检查容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
```

**健康检查**:
```bash
# Backend API
curl http://localhost:8000/docs

# Frontend
curl http://localhost:80

# 健康检查端点
curl http://localhost:80/health
```

---

## 🔧 配置说明

### docker-compose.yml 配置

#### Backend Service
```yaml
backend:
  ports:
    - "8000:8000"          # API 端口
  environment:
    - JWT_SECRET=...       # JWT 密钥（必须）
    - DEBUG=false          # 生产模式
    - MAX_CONCURRENT_TASKS=5  # 并发任务数
  volumes:
    - ./storage:/app/storage  # 数据持久化
```

#### Frontend Service
```yaml
frontend:
  ports:
    - "80:80"              # Web 端口
  environment:
    - VITE_API_URL=http://localhost:8000
```

---

## 📊 服务管理

### 启动/停止

```bash
# 启动所有服务
docker-compose start

# 停止所有服务
docker-compose stop

# 重启服务
docker-compose restart

# 停止并删除容器
docker-compose down

# 停止并删除容器+数据卷
docker-compose down -v
```

### 查看状态

```bash
# 查看容器状态
docker-compose ps

# 查看资源使用
docker stats

# 查看容器详情
docker inspect audit_backend
```

### 日志管理

```bash
# 查看实时日志
docker-compose logs -f

# 查看最近100行
docker-compose logs --tail=100

# 查看特定时间范围
docker-compose logs --since 30m
```

---

## 🔐 安全配置

### 1. JWT Secret
```bash
# 生成强随机密钥（Linux/Mac）
openssl rand -base64 32

# 设置到环境变量
export JWT_SECRET="your-generated-secret"
```

### 2. HTTPS 配置

创建 SSL 证书目录:
```bash
mkdir -p ssl
```

使用 Let's Encrypt:
```bash
# 安装 certbot
apt-get install certbot

# 获取证书
certbot certonly --standalone -d your-domain.com

# 复制证书
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/
```

---

## 💾 数据管理

### 数据持久化

**存储位置**:
```
./storage/
├── projects/          # 项目文件
├── cache/            # Parquet 缓存
├── backups/          # 数据备份
├── users.db          # 用户数据库
└── audit_logs.db     # 审计日志
```

### 备份数据

```bash
# 手动备份
./backup.sh

# 或使用 Docker 卷
docker run --rm -v audit_storage:/data -v $(pwd):/backup \
  alpine tar czf /backup/storage-backup-$(date +%Y%m%d).tar.gz /data
```

### 恢复数据

```bash
# 停止服务
docker-compose down

# 恢复数据
tar xzf storage-backup-20251211.tar.gz -C ./storage/

# 重启服务
docker-compose up -d
```

---

## 🚀 生产部署最佳实践

### 1. 资源限制

更新 `docker-compose.yml`:
```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

### 2. 健康检查

已配置:
```yaml
backend:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/docs"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### 3. 自动重启

```yaml
backend:
  restart: unless-stopped
```

### 4. 日志轮转

创建 `docker-compose.override.yml`:
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 🔍 故障排查

### 容器无法启动

```bash
# 查看容器日志
docker-compose logs backend

# 检查配置
docker-compose config

# 重新构建
docker-compose build --no-cache backend
```

### 端口冲突

```bash
# 查看端口占用
netstat -tlnp | grep 8000

# 修改端口（docker-compose.yml）
ports:
  - "8001:8000"  # 改为 8001
```

### 数据库锁定

```bash
# 进入容器
docker exec -it audit_backend bash

# 检查数据库
sqlite3 /app/storage/users.db ".tables"

# 如果锁定，重启服务
docker-compose restart backend
```

---

## 📈 监控和维护

### 性能监控

```bash
# 实时监控
docker stats

# 导出指标
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### 定期维护

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune

# 清理所有未使用资源
docker system prune -a
```

### 更新服务

```bash
# 拉取最新代码
git pull

# 重新构建
docker-compose build

# 滚动更新
docker-compose up -d --no-deps --build backend
```

---

## 📞 常见问题

### Q: 忘记管理员密码？
```bash
# 停止服务
docker-compose down

# 删除用户数据库
rm storage/users.db

# 重启服务（会创建默认管理员 admin/0000）
docker-compose up -d
```

### Q: 如何查看后端日志？
```bash
# 实时日志
docker-compose logs -f backend

# JSON 格式日志（生产）
docker exec audit_backend cat /app/logs/app.log | jq
```

### Q: 如何扩展后端？
```bash
# 运行多个后端实例
docker-compose up -d --scale backend=3

# 需要配置负载均衡器（nginx）
```

---

**部署状态**: ✅ Production Ready  
**Docker 版本**: 20.10+  
**最后测试**: 2025-12-11  
**维护者**: 审计数智析 v2 团队

---

**更多信息**: 
- [传统部署指南](./traditional-guide.md) - 非 Docker 方式
- [技术实施指南](../development/implementation-guide.md) - 完整技术文档

