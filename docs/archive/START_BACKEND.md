# 🚀 后端快速启动指南

**状态**: ✅ 后端100%完成  
**准备时间**: 5分钟  

---

## ⚡ 一键启动（推荐）

### 方式1: 使用现有数据库
```powershell
cd d:\审计数智析\packages\backend

# 1. 启动后端服务
npm run dev
```

访问: http://localhost:3000

---

## 🧪 快速测试

### 测试1: 查看API文档
```powershell
# 浏览器打开或使用curl
curl http://localhost:3000/
```

**预期**: 看到完整的API文档，包含47个端点

### 测试2: 登录获取Token
```powershell
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"admin@audit.com\",\"password\":\"admin123\"}'
```

**预期**: 返回token和用户信息

### 测试3: 创建项目
```powershell
# 替换YOUR_TOKEN为上一步获得的token
$token = "YOUR_TOKEN_HERE"

curl -X POST http://localhost:3000/api/projects `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{\"name\":\"第一个项目\",\"description\":\"测试项目\"}'
```

**预期**: 项目创建成功

### 测试4: 创建工作流
```powershell
curl -X POST http://localhost:3000/api/workflows `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{\"name\":\"第一个工作流\",\"nodes\":[],\"edges\":[]}'
```

**预期**: 工作流创建成功

### 测试5: 查看审计日志
```powershell
curl http://localhost:3000/api/audit-logs `
  -H "Authorization: Bearer $token"
```

**预期**: 看到之前操作的审计日志

---

## 📊 完整功能测试

运行完整测试脚本:
```powershell
cd d:\审计数智析

# 查看测试文档
notepad TEST_API.md
```

---

## 🔧 如果数据库未初始化

### 完整初始化流程
```powershell
cd d:\审计数智析\packages\backend

# 1. 生成Prisma Client
npm run prisma:generate

# 2. 推送数据库Schema
npm run prisma:push

# 3. 执行优化SQL
psql -U postgres -d audit_engine -f prisma/migrations/optimization_indexes.sql

# 4. 创建种子数据
npm run seed

# 5. 启动服务
npm run dev
```

---

## ✅ 系统检查清单

启动后检查以下内容:

### 1. 服务状态
- [ ] 后端服务运行在 http://localhost:3000
- [ ] 能访问根路径并看到API文档
- [ ] 健康检查通过: `GET /health`

### 2. 数据库连接
- [ ] PostgreSQL连接成功
- [ ] 数据表已创建（8个表）
- [ ] 种子数据已导入

### 3. 认证系统
- [ ] 可以登录 admin@audit.com
- [ ] Token正确返回
- [ ] 受保护路由需要Token

### 4. 核心功能
- [ ] 可以创建项目
- [ ] 可以创建工作流
- [ ] 可以查看审计日志
- [ ] 权限控制正常

---

## 🎯 默认账号

系统预置了3个测试账号:

| 用户名 | 邮箱 | 密码 | 角色 |
|-------|------|------|------|
| **admin** | admin@audit.com | admin123 | admin |
| **auditor** | auditor@audit.com | user123 | auditor |
| **testuser** | user@audit.com | user123 | user |

---

## 📈 API端点总览（47个）

### 认证 (7个)
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/change-password
- POST /api/auth/refresh
- GET /api/auth/check

### 项目 (10个)
- GET /api/projects
- POST /api/projects
- GET /api/projects/:id
- PUT /api/projects/:id
- DELETE /api/projects/:id
- POST /api/projects/:id/members
- PUT /api/projects/:id/members/:userId
- DELETE /api/projects/:id/members/:userId
- GET /api/projects/:id/workflows
- GET /api/projects/:id/stats

### 工作流 (9个)
- GET /api/workflows
- POST /api/workflows
- GET /api/workflows/:id
- PUT /api/workflows/:id
- DELETE /api/workflows/:id
- GET /api/workflows/special/templates
- POST /api/workflows/:id/clone
- GET /api/workflows/:id/executions
- GET /api/workflows/:id/stats

### 审计日志 (4个)
- GET /api/audit-logs
- GET /api/audit-logs/:id
- GET /api/audit-logs/stats/summary
- GET /api/audit-logs/resource/:type/:id

### 节点系统 (4个)
- GET /api/nodes
- GET /api/nodes/:nodeType
- POST /api/nodes/:nodeType/execute
- POST /api/nodes/:nodeType/test

### 其他 (13个)
- GET / (API文档)
- GET /health
- GET /api/node-library
- POST /api/engine/dispatch
- GET /api/engine/tasks/:taskId
- POST /api/engine/tasks/:taskId/cancel
- POST /api/execute/workflow/:id
- GET /api/execute/history
- ... 等

---

## 🚨 常见问题

### Q1: 端口3000已被占用
```powershell
# 修改端口
$env:PORT=3001
npm run dev
```

### Q2: 数据库连接失败
```powershell
# 检查.env文件中的DATABASE_URL
# 确保PostgreSQL正在运行
# 确保数据库audit_engine已创建
```

### Q3: Prisma Client错误
```powershell
# 重新生成Prisma Client
npm run prisma:generate
```

### Q4: 种子数据导入失败
```powershell
# 清空数据库后重新导入
npm run seed
```

---

## 📚 相关文档

- **API测试**: [TEST_API.md](./TEST_API.md)
- **数据库配置**: [SETUP_DATABASE.md](./SETUP_DATABASE.md)
- **完整报告**: [BACKEND_100_COMPLETE.md](./BACKEND_100_COMPLETE.md)
- **性能优化**: [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)

---

## 🎊 下一步

后端已100%完成并运行正常后，您可以:

1. ✅ **集成前端** - 连接uni-app前端
2. ✅ **API文档** - 使用Postman或Swagger
3. ✅ **部署上线** - Docker化部署
4. ✅ **性能测试** - 压力测试
5. ✅ **监控集成** - APM监控

---

**🚀 准备好了吗？启动后端，开始测试吧！**

```powershell
cd d:\审计数智析\packages\backend
npm run dev
```

**服务地址**: http://localhost:3000  
**API文档**: http://localhost:3000/  
**健康检查**: http://localhost:3000/health
