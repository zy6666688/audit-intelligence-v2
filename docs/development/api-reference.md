# API 参考

> **完整的 API 端点文档**

---

## 🔐 认证 API

### POST /auth/login
OAuth2 password flow 登录

**Request**:
```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=admin&password=0000
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

---

### POST /auth/register
注册新用户

**Request**:
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepass123",
  "full_name": "New User"
}
```

**Response**:
```json
{
  "id": "uuid-here",
  "username": "newuser",
  "email": "user@example.com",
  "full_name": "New User",
  "is_active": true,
  "is_superuser": false,
  "created_at": "2025-12-11T10:00:00"
}
```

---

### GET /auth/me
获取当前用户信息（需要认证）

**Headers**:
```
Authorization: Bearer <token>
```

**Response**:
```json
{
  "id": "uuid-here",
  "username": "admin",
  "email": "admin@example.com",
  "full_name": "Administrator",
  "is_active": true,
  "is_superuser": true
}
```

---

### POST /auth/refresh
刷新 token（需要认证）

**Response**:
```json
{
  "access_token": "new-token-here",
  "token_type": "bearer",
  "expires_in": 1800
}
```

---

## 📁 项目 API

### POST /projects/
创建新项目（需要认证）

**Request**:
```json
{
  "name": "2025年度审计",
  "description": "年度财务审计项目"
}
```

**Response**:
```json
{
  "id": "proj-abc-123",
  "name": "2025年度审计",
  "description": "年度财务审计项目",
  "created_at": "2025-12-11T10:00:00",
  "updated_at": "2025-12-11T10:00:00"
}
```

---

### GET /projects/
列出所有项目（需要认证）

**Response**:
```json
[
  {
    "id": "proj-abc-123",
    "name": "2025年度审计",
    "description": "年度财务审计项目",
    "created_at": "2025-12-11T10:00:00"
  }
]
```

---

### GET /projects/{id}
获取项目详情（需要认证）

**Response**:
```json
{
  "id": "proj-abc-123",
  "name": "2025年度审计",
  "description": "年度财务审计项目",
  "workflow": {...},
  "created_at": "2025-12-11T10:00:00",
  "updated_at": "2025-12-11T10:00:00"
}
```

---

### PUT /projects/{id}/workflow
保存工作流（需要认证）

**Request**:
```json
{
  "workflow": {
    "nodes": [...],
    "edges": [...]
  }
}
```

---

### POST /projects/{id}/upload
上传文件（需要认证）

**Request**: multipart/form-data
- `file`: 文件内容

**Response**:
```json
{
  "file_id": "file-xyz-789",
  "storage_path": "projects/proj-abc-123/data/file.xlsx",
  "file_metadata": {
    "filename": "file.xlsx",
    "size": 1024,
    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
}
```

---

### POST /projects/{id}/execute
执行项目工作流（需要认证）

**Response**:
```json
{
  "status": "submitted",
  "project_id": "proj-abc-123",
  "run_id": "run-xyz-789"
}
```

---

## 👁️ 数据预览 API

### GET /preview/node/{prompt_id}/{node_id}/{output_index}
预览节点输出数据（需要认证）

**Parameters**:
- `prompt_id`: 执行任务 ID
- `node_id`: 节点 ID
- `output_index`: 输出索引 (默认 0)
- `limit`: 返回行数 (默认 100, 最大 1000)

**Response**:
```json
{
  "rows": [
    {"col1": 1, "col2": "value"},
    {"col1": 2, "col2": "value2"}
  ],
  "total_rows": 5000,
  "columns": ["col1", "col2"],
  "schema": {
    "col1": "int64",
    "col2": "object"
  },
  "sample_values": {
    "col1": [1, 2, 3],
    "col2": ["value", "value2"]
  }
}
```

---

### GET /preview/project/{project_id}/run/{run_id}/node/{node_id}/{output_index}
预览项目运行中的节点输出（需要认证）

**Parameters**: 同上

---

## 📊 审计日志 API

### GET /audit/logs
查询审计日志（需要认证）

**Query Parameters**:
- `user_id`: 用户ID（可选）
- `action_type`: 操作类型（可选）
- `start_date`: 开始日期（可选）
- `end_date`: 结束日期（可选）
- `limit`: 返回数量（默认 100）

**Response**:
```json
[
  {
    "id": 1,
    "timestamp": "2025-12-11T10:00:00",
    "user_id": "user-123",
    "action_type": "workflow_execution",
    "target_type": "project",
    "target_id": "proj-abc-123",
    "method": "POST",
    "path": "/projects/proj-abc-123/execute",
    "status_code": 200
  }
]
```

---

### GET /audit/stats
获取审计统计（需要认证）

**Response**:
```json
{
  "total_logs": 1000,
  "by_action_type": {
    "workflow_execution": 500,
    "user_login": 200,
    "file_upload": 300
  },
  "by_user": {
    "user-123": 400,
    "user-456": 600
  }
}
```

---

## 🔌 WebSocket API

### WS /ws
WebSocket 连接（需要认证）

**连接参数**:
```
ws://host/ws?token=<jwt>&clientId=<id>
```

**消息格式**:
```json
{
  "type": "executing",
  "node": "n1",
  "step": 1,
  "max_steps": 5
}
```

**消息类型**:
- `executing` - 节点执行中
- `progress` - 执行进度
- `completed` - 执行完成
- `error` - 执行错误

---

## 📖 节点信息 API

### GET /object_info
获取所有注册节点信息（需要认证）

**Response**:
```json
{
  "ExcelLoader": {
    "input": {
      "required": {
        "file_path": ["STRING", {}]
      }
    },
    "output": ["DATAFRAME"],
    "output_name": ["dataframe"],
    "name": "ExcelLoader",
    "display_name": "Excel加载器",
    "category": "输入/文件"
  },
  ...
}
```

---

**更多信息**: 
- [技术实施指南](./implementation-guide.md) - 完整技术文档
- [部署指南](../deployment/docker-guide.md) - 部署配置

