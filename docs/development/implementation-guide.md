# 技术实施指南

> **完整的系统架构、API 参考和配置指南**  
> **最后更新**: 2025-12-12  
> **状态**: ✅ 生产就绪 (95% Complete)

---

## 🏗️ 系统架构

### 架构图
```
Frontend (Vue 3)
├── NodeEditor (Canvas)
├── DataPanel (Preview)
├── Login (Auth)
└── Monaco Editor (Script)
        ↓ HTTP/WebSocket
Backend (FastAPI)
├── PromptExecutor (DAG Engine)
├── NodeRegistry (Plugin System)
├── DataManager (Parquet Cache)
├── ProjectManager (CRUD)
├── AuditService (Logging)
└── AuthService (JWT)
        ↓
Storage
├── SQLite (users.db, audit_logs.db)
├── Parquet (cache/*.parquet)
└── Projects (projects/{id}/)
```

### 技术栈

**Backend**:
- FastAPI 0.110.0
- Python 3.12
- SQLAlchemy 2.0
- PyArrow / Pandas
- RestrictedPython
- structlog 24.1.0

**Frontend**:
- Vue 3.4.0
- Pinia 2.1.0
- vue-router 4.0.0
- Monaco Editor
- ECharts 5.5.0
- Axios 1.13.2

---

## 📊 项目完成度概览

### 总体进度: **95%** ✅

| 阶段 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| **Phase 4: Foundation** | ✅ | 100% | 配置管理、并发控制、审计日志 |
| **Phase 5: Business Features** | ✅ | 100% | 数据检查器、脚本节点、可视化 |
| **Phase 6.1: JWT Auth** | ✅ | 100% | 完整的认证系统 (Backend+Frontend) |
| **Phase 6.2: Structured Logging** | ✅ | 100% | structlog 生产级日志 |
| **Phase 6.3: Arrow Optimization** | ⏳ | 0% | 可选（大数据量时） |
| **Phase 7: Operations** | ✅ | 85% | 依赖管理、Docker 部署 |
| **Phase 8: CRDT** | ⏳ | 0% | 可选（冲突检测时） |

---

## ⚙️ 配置管理

### 环境变量

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

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `JWT_SECRET` | string | - | JWT密钥（必须设置） |
| `DEBUG` | boolean | false | 调试模式 |
| `CORS_ORIGINS` | list | ["http://localhost:5173"] | CORS白名单 |
| `MAX_CONCURRENT_TASKS` | int | 5 | 并发任务数 |
| `DATA_RETENTION_DAYS` | int | 90 | 数据保留天数 |

---

## 📡 API 参考

### 认证 API

#### POST /auth/login
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

#### POST /auth/register
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

### 项目 API

#### POST /projects/
创建新项目

**Request**:
```json
{
  "name": "2025年度审计",
  "description": "年度财务审计项目"
}
```

#### POST /projects/{id}/execute
执行项目工作流

**Response**:
```json
{
  "status": "submitted",
  "project_id": "proj-abc-123",
  "run_id": "run-xyz-789"
}
```

### 数据预览 API

#### GET /preview/node/{prompt_id}/{node_id}/{output_index}
预览节点输出数据

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

## 🔐 安全配置

### JWT Secret 管理

```bash
# 生成强随机 secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 设置环境变量
export JWT_SECRET="your-generated-secret"
```

### 密码策略
- ✅ 最少 8 个字符
- ✅ Bcrypt 哈希 (work factor 12)
- ⚠️ 建议要求：大小写+数字+特殊字符

### CORS 配置
```python
# 生产环境限制 CORS
CORS_ORIGINS = [
    "https://your-domain.com",
    "https://www.your-domain.com"
]
```

---

## 📝 日志系统

### 配置

```python
import structlog

# Development (彩色输出)
if settings.DEBUG:
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.dev.ConsoleRenderer()
        ]
    )
# Production (JSON 输出)
else:
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.JSONRenderer()
        ]
    )
```

### 使用示例

```python
from app.core.logger import get_logger

logger = get_logger(__name__)

# 事件化日志
logger.info("workflow_execution_started",
           prompt_id="abc-123",
           project_id="proj-456",
           node_count=5)

# 错误日志 + traceback
try:
    risky_operation()
except Exception as e:
    logger.error("operation_failed",
                operation="risky_operation",
                error=str(e),
                exc_info=True)
```

### 日志事件

```
Startup:
  - database_initialized
  - startup_complete

Workflow:
  - workflow_execution_started
  - workflow_timeout
  - node_execution_started
  - workflow_execution_completed

Authentication:
  - login_failed
  - user_logged_in
  - user_registered
  - user_logged_out

WebSocket:
  - websocket_authenticated
  - websocket_auth_failed
```

### 查询日志

```bash
# 使用 jq 查询 JSON 日志
python app.py 2>&1 | jq 'select(.user_id == "abc-123")'
python app.py 2>&1 | jq 'select(.level == "error")'
python app.py 2>&1 | jq 'select(.event == "workflow_timeout")'
```

---

## 🚀 性能优化

### 1. Parquet 缓存
- ✅ 二进制格式，读写快 10x
- ✅ 列式存储，压缩率高

### 2. 并发控制
- ✅ 线程池限制 (max_workers=5)
- ✅ 信号量限制 (semaphore)
- ✅ 超时机制 (timeout=300s)

### 3. 前端优化
- ✅ 组件懒加载 (vue-router)
- ✅ Tree-shaking (ECharts)
- ✅ 生产打包 (Vite build)

---

## 🧪 测试指南

### Backend Tests

```bash
cd backend
python test_auth.py      # 认证测试
python test_logging.py   # 日志测试
```

### Integration Tests

```bash
# 1. 启动后端
cd backend
uvicorn app.main:app --reload

# 2. 启动前端
cd ..
npm run dev

# 3. 登录系统
# 访问 http://localhost:5173/login
# 用户名: admin, 密码: 0000

# 4. 创建并执行工作流
```

---

**更多信息**: 
- [API 参考](./api-reference.md) - 完整 API 文档
- [部署指南](../deployment/docker-guide.md) - 部署配置

