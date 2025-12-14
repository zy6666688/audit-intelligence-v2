# 🗄️ 数据库配置指南

本文档详细说明如何配置和初始化数据库系统。

---

## 📋 前置要求

### 1. 安装PostgreSQL

**Windows**:
```powershell
# 使用Chocolatey安装
choco install postgresql

# 或下载官方安装包
# https://www.postgresql.org/download/windows/
```

**Mac**:
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu)**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. 安装Redis

**Windows**:
```powershell
# 使用Chocolatey安装
choco install redis-64

# 启动Redis
redis-server
```

**Mac**:
```bash
brew install redis
brew services start redis
```

**Linux**:
```bash
sudo apt install redis-server
sudo systemctl start redis
```

---

## 🚀 快速开始

### 步骤1: 创建数据库

```bash
# 登录PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE audit_engine;

# 创建用户(可选)
CREATE USER audit_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE audit_engine TO audit_user;

# 退出
\q
```

### 步骤2: 配置环境变量

复制环境变量模板：
```bash
cd packages/backend
cp .env.example .env
```

编辑`.env`文件：
```env
# 数据库配置
DATABASE_URL="postgresql://postgres:password@localhost:5432/audit_engine?schema=public"

# Redis配置
REDIS_URL="redis://localhost:6379"

# JWT配置
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_EXPIRES_IN="7d"

# 服务器配置
PORT=3000
NODE_ENV=development
```

### 步骤3: 安装依赖

```bash
cd packages/backend
npm install
```

### 步骤4: 生成Prisma Client

```bash
npm run prisma:generate
```

### 步骤5: 运行数据库迁移

```bash
npm run prisma:migrate
# 或使用 db:push (开发环境)
npm run db:push
```

### 步骤6: 初始化种子数据

```bash
npm run prisma:seed
```

### 步骤7: 启动服务器

```bash
npm run dev
```

---

## 🛠️ 详细说明

### Prisma 命令

```bash
# 生成Prisma Client
npm run prisma:generate

# 创建新迁移
npm run prisma:migrate

# 推送Schema到数据库(无迁移记录)
npm run db:push

# 重置数据库(危险!)
npm run db:reset

# 打开Prisma Studio(可视化管理界面)
npm run prisma:studio

# 运行种子脚本
npm run prisma:seed
```

### 数据库连接字符串格式

```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=[schema名]
```

示例：
```
postgresql://postgres:mypassword@localhost:5432/audit_engine?schema=public
```

### Redis连接字符串格式

```
redis://[主机]:[端口]
```

示例：
```
redis://localhost:6379
redis://:password@localhost:6379  # 带密码
```

---

## 📊 数据库Schema

### 核心表

| 表名 | 说明 | 记录数(预估) |
|------|------|--------------|
| users | 用户表 | 100-1000 |
| projects | 项目表 | 500-5000 |
| workflows | 工作流表 | 1000-10000 |
| execution_history | 执行历史 | 10000+ |
| node_execution_logs | 节点日志 | 100000+ |
| audit_logs | 审计日志 | 50000+ |

### 关系图

```
users
├── projects (owner)
├── project_members
├── workflows (creator)
├── execution_history (executor)
├── audit_logs
└── files

projects
├── workflows
├── project_members
└── files

workflows
├── execution_history
└── files

execution_history
└── node_execution_logs
```

---

## 🔧 开发工具

### Prisma Studio

可视化数据库管理工具：

```bash
npm run prisma:studio
```

访问 http://localhost:5555

### 数据库备份

```bash
# 备份
pg_dump -U postgres -d audit_engine > backup.sql

# 恢复
psql -U postgres -d audit_engine < backup.sql
```

---

## 🧪 测试数据

运行种子脚本后，会创建：

### 用户账号
- **管理员**: admin@audit.com / admin123
- **审计员**: auditor@audit.com / user123

### 示例项目
- 名称: 2024年度财务审计
- 客户: ABC公司
- 类型: 财务审计

### 示例工作流
- 名称: 凭证审计流程
- 分类: 审计
- 状态: 已发布模板

---

## ⚠️ 常见问题

### 1. 连接失败: "Connection refused"

**原因**: PostgreSQL未启动

**解决**:
```bash
# Windows
net start postgresql-x64-15

# Mac
brew services start postgresql@15

# Linux
sudo systemctl start postgresql
```

### 2. 权限错误: "permission denied"

**原因**: 用户权限不足

**解决**:
```sql
GRANT ALL PRIVILEGES ON DATABASE audit_engine TO your_user;
GRANT ALL ON SCHEMA public TO your_user;
```

### 3. Prisma生成失败

**原因**: Schema语法错误或依赖未安装

**解决**:
```bash
# 重新安装依赖
npm install

# 验证Schema
npx prisma validate

# 强制重新生成
npx prisma generate --force
```

### 4. Redis连接失败

**原因**: Redis未启动

**解决**:
```bash
# Windows
redis-server

# Mac
brew services start redis

# Linux
sudo systemctl start redis
```

---

## 🔒 生产环境配置

### 1. 使用连接池

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&connection_limit=20&pool_timeout=20"
```

### 2. SSL连接

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&sslmode=require"
```

### 3. Redis持久化

编辑 `redis.conf`:
```conf
save 900 1
save 300 10
save 60 10000
appendonly yes
```

### 4. 定期备份

创建cron任务:
```bash
# 每天凌晨2点备份
0 2 * * * pg_dump -U postgres audit_engine > /backup/audit_$(date +\%Y\%m\%d).sql
```

---

## 📈 性能优化

### 1. 索引优化

已在Schema中定义的索引：
- 用户邮箱、用户名
- 项目所有者
- 工作流项目ID、创建者
- 执行历史状态、时间
- 审计日志多维度

### 2. 查询优化

使用`include`和`select`减少数据传输：
```typescript
// 好的做法
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    username: true,
    email: true,
  },
});

// 避免
const user = await prisma.user.findUnique({ where: { id } });
```

### 3. 批量操作

```typescript
// 使用事务批量插入
await prisma.$transaction([
  prisma.user.create({ data: user1 }),
  prisma.user.create({ data: user2 }),
]);
```

---

## 🎯 下一步

完成数据库配置后：
1. ✅ 启动后端服务: `npm run dev`
2. ✅ 测试API接口
3. ✅ 配置前端连接
4. ✅ 开始开发

---

**配置完成后，访问**:
- 后端API: http://localhost:3000
- Prisma Studio: http://localhost:5555

**登录测试账号**:
- admin@audit.com / admin123
