# 传统部署指南

> **非 Docker 方式的部署指南**

---

## 📋 环境要求

- Python 3.12+
- Node.js 18+
- SQLite 3
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

---

## 🔧 后端部署

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

创建 `.env` 文件：
```bash
# JWT 配置（必须）
JWT_SECRET=your-very-secure-random-secret-key-here

# 生产环境配置
DEBUG=false
CORS_ORIGINS=["https://your-domain.com"]

# 可选配置
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=30
MAX_CONCURRENT_TASKS=5
DATA_RETENTION_DAYS=90
```

### 3. 初始化数据库

数据库会在首次启动时自动创建：
- `storage/users.db` - 用户数据库
- `storage/audit_logs.db` - 审计日志数据库

### 4. 启动服务

**开发模式**:
```bash
uvicorn app.main:app --reload
```

**生产模式**:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 🎨 前端部署

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

```bash
npm run dev
```

### 3. 生产构建

```bash
npm run build
# 输出到 dist/ 目录
```

### 4. 部署静态文件

**使用 Nginx**:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
    }
}
```

---

## 🔒 安全配置

### 1. JWT Secret 管理

```bash
# 生成强随机 secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 设置环境变量
export JWT_SECRET="your-generated-secret"
```

### 2. 数据库备份

```bash
# 定期备份用户数据库
cp storage/users.db storage/backups/users.db.$(date +%Y%m%d)

# 备份审计日志
cp storage/audit_logs.db storage/backups/audit_logs.db.$(date +%Y%m%d)
```

### 3. CORS 配置

```python
# 生产环境限制 CORS
CORS_ORIGINS = [
    "https://your-domain.com",
    "https://www.your-domain.com"
]
```

---

## 📊 性能优化

### 1. 使用 Gunicorn（推荐）

```bash
pip install gunicorn

# 启动
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 2. 使用 Supervisor 管理进程

创建 `/etc/supervisor/conf.d/audit-backend.conf`:
```ini
[program:audit-backend]
command=/path/to/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
directory=/path/to/backend
user=www-data
autostart=true
autorestart=true
```

---

## 🔍 故障排查

### 端口冲突

```bash
# 查看端口占用
netstat -tlnp | grep 8000

# 修改端口（.env 或启动参数）
uvicorn app.main:app --port 8001
```

### 数据库锁定

```bash
# 检查数据库
sqlite3 storage/users.db ".tables"

# 如果锁定，重启服务
```

### 内存不足

```bash
# 查看资源使用
top
htop

# 减少并发任务数（.env）
MAX_CONCURRENT_TASKS=3
```

---

## 📈 监控和维护

### 查看日志

```bash
# 开发环境：控制台输出
uvicorn app.main:app --reload

# 生产环境：JSON 日志 + jq 查询
python app.py 2>&1 | jq 'select(.level == "error")'
```

### 定期维护

```bash
# 清理缓存
rm -rf storage/cache/*

# 清理旧数据（超过保留期）
# 需要编写清理脚本
```

---

## 🆘 常见问题

### Q: 忘记管理员密码？

```bash
# 删除用户数据库，重新初始化
rm storage/users.db
# 重启后端，会创建默认管理员 (admin/0000)
```

### Q: 如何查看结构化日志？

```bash
# 开发环境：控制台彩色输出
uvicorn app.main:app --reload

# 生产环境：JSON 日志 + jq 查询
python app.py 2>&1 | jq 'select(.level == "error")'
```

---

**推荐**: 生产环境建议使用 [Docker 部署](./docker-guide.md)，更简单可靠。

