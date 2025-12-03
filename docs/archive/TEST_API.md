# 🧪 API测试指南

**测试时间**: 2025-12-01  
**后端地址**: http://localhost:3000

---

## 🚀 快速测试流程

### 1️⃣ 用户认证测试

#### 登录获取Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@audit.com",
    "password": "admin123"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@audit.com",
      "role": "admin",
      "status": "active"
    }
  },
  "message": "登录成功"
}
```

**保存Token**: 复制响应中的 `token` 值，后续请求需要使用。

---

### 2️⃣ 项目管理测试

#### 设置环境变量（方便测试）
```bash
# Windows PowerShell
$token = "粘贴你的token"

# Linux/Mac
export TOKEN="粘贴你的token"
```

#### 创建项目
```bash
# PowerShell
curl -X POST http://localhost:3000/api/projects `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{
    "name": "2024年度财务审计",
    "description": "某公司2024年度财务报表审计项目",
    "auditType": "financial",
    "clientName": "测试公司",
    "auditPeriod": "2024-01-01至2024-12-31",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'

# Linux/Mac
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "2024年度财务审计",
    "description": "某公司2024年度财务报表审计项目",
    "auditType": "financial",
    "clientName": "测试公司",
    "auditPeriod": "2024-01-01至2024-12-31",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "id": "project-uuid",
    "name": "2024年度财务审计",
    "ownerId": "admin-uuid",
    "status": "active",
    "createdAt": "2024-12-01T..."
  },
  "message": "项目创建成功"
}
```

**保存项目ID**: 复制响应中的 `id` 值。

#### 获取项目列表
```bash
# PowerShell
curl http://localhost:3000/api/projects `
  -H "Authorization: Bearer $token"

# Linux/Mac
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN"
```

#### 获取项目详情
```bash
# PowerShell  
$projectId = "粘贴项目ID"
curl http://localhost:3000/api/projects/$projectId `
  -H "Authorization: Bearer $token"

# Linux/Mac
export PROJECT_ID="粘贴项目ID"
curl http://localhost:3000/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### 添加项目成员
```bash
# 首先注册一个新用户作为成员
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "auditor1",
    "email": "auditor1@example.com",
    "password": "test123",
    "displayName": "审计员1"
  }'

# 保存新用户的ID，然后添加为项目成员
# PowerShell
$userId = "新用户的ID"
curl -X POST http://localhost:3000/api/projects/$projectId/members `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d "{\"userId\": \"$userId\", \"role\": \"editor\"}"

# Linux/Mac
export USER_ID="新用户的ID"
curl -X POST http://localhost:3000/api/projects/$PROJECT_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"userId\": \"$USER_ID\", \"role\": \"editor\"}"
```

#### 获取项目统计
```bash
# PowerShell
curl http://localhost:3000/api/projects/$projectId/stats `
  -H "Authorization: Bearer $token"

# Linux/Mac
curl http://localhost:3000/api/projects/$PROJECT_ID/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3️⃣ 认证功能测试

#### 获取当前用户信息
```bash
# PowerShell
curl http://localhost:3000/api/auth/me `
  -H "Authorization: Bearer $token"

# Linux/Mac
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

#### 检查Token有效性
```bash
# PowerShell
curl http://localhost:3000/api/auth/check `
  -H "Authorization: Bearer $token"

# Linux/Mac
curl http://localhost:3000/api/auth/check \
  -H "Authorization: Bearer $TOKEN"
```

#### 修改密码
```bash
# PowerShell
curl -X POST http://localhost:3000/api/auth/change-password `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{
    "oldPassword": "admin123",
    "newPassword": "newpass123"
  }'

# Linux/Mac
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "oldPassword": "admin123",
    "newPassword": "newpass123"
  }'
```

---

### 4️⃣ 权限测试

#### 测试普通用户权限（应该失败）
```bash
# 1. 先用普通用户登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "auditor@audit.com",
    "password": "user123"
  }'

# 2. 保存普通用户的token
# PowerShell
$userToken = "粘贴auditor的token"

# Linux/Mac  
export USER_TOKEN="粘贴auditor的token"

# 3. 尝试访问管理员功能（应该返回403）
# PowerShell
curl -X DELETE http://localhost:3000/api/projects/$projectId `
  -H "Authorization: Bearer $userToken"

# Linux/Mac
curl -X DELETE http://localhost:3000/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $USER_TOKEN"
```

**预期响应** (403 Forbidden):
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "您没有权限访问此资源"
}
```

---

### 5️⃣ 节点系统测试

#### 获取节点列表
```bash
curl http://localhost:3000/api/nodes
```

#### 获取节点库（按分类）
```bash
curl http://localhost:3000/api/node-library
```

---

## 📋 完整测试场景

### 场景1: 创建审计项目工作流

```bash
# 1. 管理员登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@audit.com","password":"admin123"}'

# 保存token
TOKEN="..."

# 2. 创建项目
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "ABC公司2024审计",
    "description": "年度财务审计",
    "auditType": "financial",
    "clientName": "ABC公司"
  }'

# 保存项目ID
PROJECT_ID="..."

# 3. 注册审计员
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "auditor_zhang",
    "email": "zhang@example.com",
    "password": "zhang123",
    "displayName": "张审计"
  }'

# 保存审计员ID
AUDITOR_ID="..."

# 4. 添加审计员到项目
curl -X POST http://localhost:3000/api/projects/$PROJECT_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"userId\":\"$AUDITOR_ID\",\"role\":\"editor\"}"

# 5. 查看项目详情（含成员）
curl http://localhost:3000/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"

# 6. 获取项目统计
curl http://localhost:3000/api/projects/$PROJECT_ID/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔍 错误场景测试

### 测试1: 未登录访问
```bash
# 应该返回401
curl http://localhost:3000/api/projects
```

### 测试2: Token过期
```bash
# 使用过期token，应该返回401
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer expired_token"
```

### 测试3: 权限不足
```bash
# 普通用户尝试删除项目，应该返回403
curl -X DELETE http://localhost:3000/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $USER_TOKEN"
```

### 测试4: 资源不存在
```bash
# 访问不存在的项目，应该返回404
curl http://localhost:3000/api/projects/non-existent-id \
  -H "Authorization: Bearer $TOKEN"
```

---

## ✅ 测试检查清单

### 认证功能
- [ ] 用户可以注册
- [ ] 用户可以登录
- [ ] Token正确返回
- [ ] 受保护路由需要Token
- [ ] 无效Token被拒绝
- [ ] 用户可以修改密码
- [ ] 用户可以登出

### 项目管理
- [ ] 创建项目成功
- [ ] 获取项目列表
- [ ] 获取项目详情
- [ ] 更新项目信息
- [ ] 软删除项目
- [ ] 添加项目成员
- [ ] 更新成员角色
- [ ] 移除项目成员
- [ ] 获取项目工作流
- [ ] 获取项目统计

### 权限控制
- [ ] Admin可以访问所有资源
- [ ] Auditor可以管理自己的项目
- [ ] User只能查看和执行
- [ ] 非成员无法访问项目
- [ ] 不能移除项目所有者

---

## 📊 性能测试

### 批量创建项目
```bash
# PowerShell
for ($i=1; $i -le 10; $i++) {
  curl -X POST http://localhost:3000/api/projects `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $token" `
    -d "{\"name\":\"测试项目$i\",\"description\":\"性能测试\"}"
}

# Linux/Mac
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/projects \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\":\"测试项目$i\",\"description\":\"性能测试\"}"
done
```

### 分页测试
```bash
# 获取第1页（默认20条）
curl "http://localhost:3000/api/projects?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# 获取第2页
curl "http://localhost:3000/api/projects?page=2&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 搜索测试
```bash
curl "http://localhost:3000/api/projects?search=审计" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎯 下一步

测试通过后，可以：
1. ✅ 集成前端
2. ✅ 实现工作流管理
3. ✅ 添加文件上传
4. ✅ 集成审计日志

---

**测试愉快！** 🚀
