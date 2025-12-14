# 🚢 部署指南

## 生产环境部署

### 环境准备

#### 系统要求
- Node.js >= 16.0.0
- npm >= 8.0.0
- 内存 >= 4GB
- 存储 >= 10GB

#### 环境变量

创建 `.env.production` 文件：

```env
# 应用配置
NODE_ENV=production
PORT=3000

# OpenAI配置
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1

# 数据库配置（如需要）
# DATABASE_URL=postgresql://user:password@localhost:5432/audit

# 日志配置
LOG_LEVEL=info
LOG_FILE=/var/log/audit-app.log

# 安全配置
JWT_SECRET=your_secret_key_here
CORS_ORIGIN=https://your-domain.com
```

### 构建步骤

#### 1. 构建Shared包

```bash
cd packages/shared
npm install
npm run build
```

#### 2. 构建Backend

```bash
cd packages/backend
npm install
npm run build
```

#### 3. 构建Frontend

```bash
# 返回根目录
cd ../..

# 构建H5版本
npm run build:h5

# 或构建其他平台
npm run build:mp-weixin   # 微信小程序
```

### 部署方式

#### 方式一：传统服务器部署

**1. 上传文件**
```bash
# 打包项目
tar -czf audit-app.tar.gz packages/ dist/ package.json

# 上传到服务器
scp audit-app.tar.gz user@server:/var/www/
```

**2. 服务器配置**
```bash
# 解压
cd /var/www
tar -xzf audit-app.tar.gz

# 安装依赖（仅生产依赖）
npm install --production

# 启动后端
cd packages/backend
npm start
```

**3. 使用PM2管理进程**
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start packages/backend/dist/index.js --name audit-backend

# 开机自启
pm2 startup
pm2 save

# 监控
pm2 monit
```

**4. 配置Nginx反向代理**

创建 `/etc/nginx/sites-available/audit-app`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/audit-app/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket支持（协作功能）
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

启用配置：
```bash
ln -s /etc/nginx/sites-available/audit-app /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### 方式二：Docker部署

**1. 创建Dockerfile**

`packages/backend/Dockerfile`:
```dockerfile
FROM node:16-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# 安装依赖
RUN cd packages/shared && npm install && npm run build
RUN cd packages/backend && npm install --production

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "packages/backend/dist/index.js"]
```

**2. 创建docker-compose.yml**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
    restart: unless-stopped
```

**3. 启动服务**
```bash
docker-compose up -d
```

#### 方式三：云平台部署

**Vercel（前端）**
```bash
# 安装Vercel CLI
npm install -g vercel

# 部署
vercel --prod
```

**Railway/Render（后端）**
1. 连接GitHub仓库
2. 配置构建命令: `cd packages/backend && npm install && npm run build`
3. 配置启动命令: `node packages/backend/dist/index.js`
4. 设置环境变量

### 性能优化

#### 1. 启用Gzip压缩

Nginx配置：
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

#### 2. 启用缓存

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### 3. CDN加速

将静态资源上传到CDN：
```bash
# 使用阿里云OSS、腾讯云COS等
```

### 监控与日志

#### 1. 应用监控

使用PM2监控：
```bash
pm2 logs audit-backend
pm2 monit
```

#### 2. 性能监控

集成监控服务：
- Sentry (错误追踪)
- DataDog (性能监控)
- Prometheus + Grafana (指标监控)

#### 3. 日志收集

使用Winston/Bunyan记录日志：
```javascript
// 后端日志配置
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 安全配置

#### 1. HTTPS配置

使用Let's Encrypt免费证书：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 2. 安全头配置

Nginx添加安全头：
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

#### 3. 限流配置

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://localhost:3000;
}
```

### 备份策略

#### 1. 数据备份

```bash
# 定时备份脚本
#!/bin/bash
BACKUP_DIR="/var/backups/audit-app"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据
tar -czf $BACKUP_DIR/data_$DATE.tar.gz /var/www/audit-app/data

# 保留最近7天备份
find $BACKUP_DIR -type f -mtime +7 -delete
```

添加到crontab：
```bash
0 2 * * * /path/to/backup.sh
```

#### 2. 配置备份

定期备份配置文件和环境变量。

### 扩展部署

#### 负载均衡

使用Nginx负载均衡多个后端实例：

```nginx
upstream backend_servers {
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}

server {
    location /api {
        proxy_pass http://backend_servers;
    }
}
```

#### 数据库集群

如果使用数据库，配置主从复制或集群。

### 回滚策略

#### 1. 使用Git标签

```bash
# 标记版本
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 回滚到指定版本
git checkout v1.0.0
```

#### 2. 使用PM2保存配置

```bash
# 保存当前配置
pm2 save

# 恢复配置
pm2 resurrect
```

### 健康检查

创建健康检查端点：

```javascript
// 后端添加健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### 部署检查清单

部署前检查：
- [ ] 所有测试通过
- [ ] 环境变量已配置
- [ ] 数据库已迁移
- [ ] 静态资源已构建
- [ ] SSL证书已配置
- [ ] 备份策略已设置
- [ ] 监控已启用
- [ ] 日志已配置

部署后验证：
- [ ] 应用可正常访问
- [ ] API接口正常
- [ ] 静态资源加载正常
- [ ] WebSocket连接正常
- [ ] 性能指标正常
- [ ] 错误日志无异常

---

**部署成功！** 🎉
