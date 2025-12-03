# ⚡ 方案A优化 - 执行指南

**状态**: 🔄 执行中  
**时间**: 2025-12-01 16:11

---

## ✅ 已完成步骤

- [x] **Step 1**: DataLoader依赖已安装
- [x] **Step 2**: Prisma Client已生成

---

## 📋 待执行步骤

### Step 3: 安装/启动PostgreSQL (5分钟)

#### 检查PostgreSQL是否已安装

打开命令行，执行：
```powershell
psql --version
```

**如果未安装**，请选择以下方式之一：

#### 方式1: 使用Chocolatey安装 (推荐)
```powershell
# 以管理员权限运行PowerShell
choco install postgresql

# 安装后，启动服务
net start postgresql-x64-15
```

#### 方式2: 下载官方安装包
1. 访问: https://www.postgresql.org/download/windows/
2. 下载并安装PostgreSQL 15+
3. 记住设置的密码（默认用户: postgres）
4. 确保安装时勾选"pgAdmin"和"命令行工具"

#### 方式3: 使用Docker (如果已安装Docker)
```powershell
docker run --name postgres-audit -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

---

### Step 4: 创建数据库 (2分钟)

执行以下命令创建数据库：

```powershell
# 方式1: 使用命令行
psql -U postgres -c "CREATE DATABASE audit_engine;"

# 方式2: 如果上面命令失败，使用完整路径
# 查找psql.exe位置（通常在 C:\Program Files\PostgreSQL\15\bin\）
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE DATABASE audit_engine;"

# 方式3: 使用pgAdmin
# 1. 打开pgAdmin
# 2. 右键"Databases" -> "Create" -> "Database"
# 3. 名称输入: audit_engine
# 4. 点击"Save"
```

**验证数据库创建成功**:
```powershell
psql -U postgres -l
# 应该能看到 audit_engine 数据库
```

---

### Step 5: 配置环境变量 (3分钟)

#### 5.1 检查.env文件

```powershell
cd d:\审计数智析\packages\backend

# 检查.env文件是否存在
dir .env
```

如果不存在，复制模板：
```powershell
copy .env.example .env
```

#### 5.2 编辑.env文件

打开 `packages\backend\.env`，配置以下内容：

```env
# 数据库配置 (根据实际情况修改密码)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/audit_engine?schema=public"

# Redis配置 (如果还未安装Redis，暂时可以跳过)
REDIS_URL="redis://localhost:6379"

# JWT配置
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# 服务器配置
PORT=3000
NODE_ENV=development
```

**重要**: 
- 将 `postgres:postgres` 中第二个 `postgres` 改为您设置的PostgreSQL密码
- 如果PostgreSQL端口不是5432，请修改端口号

---

### Step 6: 初始化数据库Schema (5分钟)

#### 6.1 推送Schema到数据库

```powershell
cd d:\审计数智析\packages\backend

# 推送数据库Schema
npm run db:push
```

**预期输出**:
```
✔ Your database is now in sync with your Prisma schema.
```

#### 6.2 如果出错

**错误1: "Can't reach database server"**
```
原因: PostgreSQL未启动或连接信息错误
解决: 
1. 检查PostgreSQL服务是否运行: net start postgresql-x64-15
2. 检查.env中的DATABASE_URL是否正确
3. 检查密码是否正确
```

**错误2: "Database 'audit_engine' does not exist"**
```
原因: 数据库未创建
解决: 执行Step 4创建数据库
```

---

### Step 7: 执行优化SQL (5分钟) ⭐ 核心步骤

#### 7.1 找到psql命令

```powershell
# 方式1: 如果psql在PATH中
where.exe psql

# 方式2: 常见安装路径
# C:\Program Files\PostgreSQL\15\bin\psql.exe
# C:\Program Files\PostgreSQL\16\bin\psql.exe
```

#### 7.2 执行优化脚本

```powershell
cd d:\审计数智析\packages\backend

# 使用psql执行优化SQL
psql -U postgres -d audit_engine -f prisma\migrations\optimization_indexes.sql

# 如果psql不在PATH中，使用完整路径
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d audit_engine -f prisma\migrations\optimization_indexes.sql
```

**预期输出**:
```
BEGIN
CREATE INDEX
CREATE INDEX
CREATE INDEX
... (会看到多个CREATE INDEX)
CREATE MATERIALIZED VIEW
CREATE UNIQUE INDEX
...
COMMIT
✅ 数据库优化完成!
```

#### 7.3 更新统计信息

```powershell
# 更新数据库统计信息
psql -U postgres -d audit_engine -c "ANALYZE;"

# 或使用完整路径
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d audit_engine -c "ANALYZE;"
```

---

### Step 8: 验证优化效果 (5分钟)

#### 8.1 检查索引创建情况

```powershell
psql -U postgres -d audit_engine -c "SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;"
```

**预期输出**: 应该看到包含 `idx_execution_workflow_time`、`idx_workflow_nodes` 等多个新索引

#### 8.2 检查物化视图

```powershell
psql -U postgres -d audit_engine -c "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';"
```

**预期输出**: 应该看到 `workflow_execution_stats`、`user_activity_stats`、`project_stats`

#### 8.3 查看索引大小

```powershell
psql -U postgres -d audit_engine -c "SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size FROM pg_indexes WHERE schemaname = 'public' ORDER BY pg_relation_size(indexname::regclass) DESC LIMIT 10;"
```

---

### Step 9: (可选) 初始化测试数据 (3分钟)

如果您想要创建测试账号和示例数据：

```powershell
cd d:\审计数智析\packages\backend

npm run prisma:seed
```

**预期输出**:
```
✅ 管理员创建完成: admin@audit.com
✅ 测试用户创建完成: auditor@audit.com
✅ 示例项目创建完成: 2024年度财务审计
✅ 项目成员添加完成
✅ 示例工作流创建完成: 凭证审计流程

🎉 数据播种完成!

📝 登录信息:
管理员: admin@audit.com / admin123
审计员: auditor@audit.com / user123
```

---

### Step 10: 启动服务验证 (2分钟)

```powershell
cd d:\审计数智析\packages\backend

npm run dev
```

**预期输出**:
```
✅ Prisma连接成功
✅ Redis连接成功 (如果配置了Redis)
Server running on http://localhost:3000
```

打开浏览器访问: http://localhost:3000

---

## 🚨 故障排除

### 问题1: PostgreSQL未安装

**症状**: `psql: 无法将"psql"项识别为 cmdlet`

**解决**:
1. 安装PostgreSQL (见Step 3)
2. 或使用Docker: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres -d postgres:15`

### 问题2: 数据库连接失败

**症状**: `Can't reach database server`

**检查清单**:
- [ ] PostgreSQL服务是否运行: `net start postgresql-x64-15`
- [ ] 端口5432是否被占用: `netstat -an | findstr 5432`
- [ ] .env中的DATABASE_URL是否正确
- [ ] 密码是否正确

**解决**:
```powershell
# 检查服务状态
Get-Service | Where-Object {$_.Name -like "*postgres*"}

# 启动服务
net start postgresql-x64-15
```

### 问题3: 优化SQL执行失败

**症状**: `ERROR: relation "xxx" does not exist`

**原因**: 数据库Schema未初始化

**解决**:
```powershell
# 先初始化Schema
npm run db:push

# 然后再执行优化SQL
psql -U postgres -d audit_engine -f prisma\migrations\optimization_indexes.sql
```

### 问题4: Redis连接失败

**影响**: 不影响核心功能，只是缓存功能不可用

**解决方案**:

**临时方案**: 修改代码忽略Redis错误
```typescript
// packages/backend/src/services/CacheService.ts
this.redis.on('error', (error) => {
  console.warn('⚠️ Redis未启动，缓存功能暂时禁用');
  // 不抛出错误，应用继续运行
});
```

**永久方案**: 安装Redis
```powershell
# 使用Chocolatey
choco install redis-64

# 启动Redis
redis-server

# 或使用Docker
docker run -p 6379:6379 -d redis:7
```

---

## 📊 优化完成检查清单

完成以下所有检查后，优化即成功：

- [ ] PostgreSQL已安装并运行
- [ ] 数据库 `audit_engine` 已创建
- [ ] `.env` 文件已配置
- [ ] Schema已推送到数据库 (`npm run db:push`)
- [ ] 优化SQL已执行 (16个索引 + 3个视图)
- [ ] `ANALYZE` 已运行
- [ ] DataLoader已安装
- [ ] Prisma Client已生成
- [ ] (可选) 测试数据已初始化
- [ ] 服务器能成功启动

---

## 🎯 预期优化效果

完成所有步骤后，您将获得：

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **工作流列表查询** | 200ms | 40ms | 5x ⬆️ |
| **执行历史查询** | 500ms | 50ms | 10x ⬆️ |
| **统计报表** | 2000ms | 20ms | 100x ⬆️ |
| **节点类型搜索** | 1000ms | 100ms | 10x ⬆️ |
| **用户登录** | 50ms | 10ms | 5x ⬆️ |

---

## 📝 下一步

优化完成后：

1. **监控性能**: 观察实际查询时间
2. **配置定时刷新**: 设置物化视图自动刷新 (见OPTIMIZATION_QUICK_START.md)
3. **生产部署**: 在生产环境执行相同优化
4. **持续优化**: 根据慢查询日志进一步优化

---

## 💬 需要帮助？

如果遇到问题：

1. 查看 [OPTIMIZATION_QUICK_START.md](./OPTIMIZATION_QUICK_START.md) - 快速指南
2. 查看 [PERSISTENCE_OPTIMIZATION_ANALYSIS.md](./PERSISTENCE_OPTIMIZATION_ANALYSIS.md) - 深度分析
3. 检查 PostgreSQL 日志: `C:\Program Files\PostgreSQL\15\data\log\`
4. 提供错误信息以便进一步协助

---

**当前进度**: 40% (2/5 步骤已完成)  
**下一步**: 执行 Step 3 - 安装/启动PostgreSQL

加油！优化即将完成！🚀
