# 🚀 生产环境上线路线图

**开始时间**: 2025-12-01  
**目标**: 20-25个工作日完成生产级功能  
**当前阶段**: 阶段1 - 数据持久化

---

## 📋 总体规划

### 核心目标
1. ✅ **数据持久化** - PostgreSQL + Redis + Prisma ORM
2. ✅ **用户认证** - JWT + RBAC权限系统
3. ✅ **项目管理** - 核心业务功能
4. ✅ **生产部署** - Docker + 监控

### 时间规划
```
Week 1 (Day 1-5):  数据库设计 + 数据持久化层
Week 2 (Day 6-10): 用户系统 + 权限控制
Week 3 (Day 11-15): 项目管理模块
Week 4 (Day 16-20): 审计日志 + 文件服务
Week 5 (Day 21-25): 部署配置 + 测试上线
```

---

## 🎯 阶段1: 数据持久化 (Day 1-5)

### Day 1: 数据库设计和配置 ⏳

#### 任务清单
- [x] 数据库Schema设计
- [ ] Prisma配置和初始化
- [ ] PostgreSQL连接
- [ ] Redis配置
- [ ] 初始化迁移脚本

#### 数据表设计

**1. 用户表 (users)**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  role VARCHAR(20) NOT NULL DEFAULT 'user', -- admin, auditor, user
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, deleted
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP
);
```

**2. 项目表 (projects)**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, archived, deleted
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 审计元数据
  audit_type VARCHAR(50), -- financial, compliance, risk
  client_name VARCHAR(200),
  audit_period VARCHAR(50)
);
```

**3. 工作流表 (workflows)**
```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- audit, finance, risk
  
  -- 工作流定义
  nodes JSONB NOT NULL, -- 节点数组
  edges JSONB NOT NULL, -- 连接数组
  viewport JSONB, -- 视口状态
  
  -- 元数据
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 统计
  execution_count INTEGER DEFAULT 0,
  avg_execution_time NUMERIC(10,2),
  last_executed_at TIMESTAMP,
  
  -- 版本控制
  version INTEGER DEFAULT 1,
  is_template BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE
);
```

**4. 执行历史表 (execution_history)**
```sql
CREATE TABLE execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  task_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- 执行状态
  status VARCHAR(20) NOT NULL, -- pending, running, completed, failed, cancelled
  progress NUMERIC(5,2) DEFAULT 0,
  
  -- 时间
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration NUMERIC(10,2), -- 秒
  
  -- 执行结果
  node_results JSONB, -- 节点执行结果
  final_output JSONB,
  error_message TEXT,
  
  -- 执行者
  executed_by UUID NOT NULL REFERENCES users(id),
  
  -- 执行参数
  input_params JSONB,
  
  -- 统计
  nodes_total INTEGER,
  nodes_completed INTEGER,
  nodes_failed INTEGER
);
```

**5. 节点执行日志表 (node_execution_logs)**
```sql
CREATE TABLE node_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES execution_history(id),
  node_id VARCHAR(100) NOT NULL,
  node_type VARCHAR(100) NOT NULL,
  
  -- 状态
  status VARCHAR(20) NOT NULL,
  
  -- 时间
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration NUMERIC(10,2),
  
  -- 数据
  input JSONB,
  output JSONB,
  error TEXT,
  
  -- 性能指标
  memory_used BIGINT, -- bytes
  cpu_time NUMERIC(10,2) -- seconds
);
```

**6. 审计日志表 (audit_logs)**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  -- 操作信息
  action VARCHAR(50) NOT NULL, -- create, update, delete, execute, login
  resource_type VARCHAR(50) NOT NULL, -- workflow, project, user
  resource_id VARCHAR(100),
  
  -- 详情
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  -- 时间
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 索引优化
  INDEX idx_audit_user_time (user_id, created_at),
  INDEX idx_audit_resource (resource_type, resource_id),
  INDEX idx_audit_action_time (action, created_at)
);
```

**7. 项目成员表 (project_members)**
```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(20) NOT NULL, -- owner, editor, viewer
  
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, user_id)
);
```

**8. 文件表 (files)**
```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  workflow_id UUID REFERENCES workflows(id),
  
  -- 文件信息
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size BIGINT NOT NULL, -- bytes
  
  -- 存储
  storage_path VARCHAR(1000) NOT NULL,
  storage_type VARCHAR(20) DEFAULT 'local', -- local, s3, oss
  
  -- OCR结果
  ocr_result JSONB,
  ocr_status VARCHAR(20), -- pending, processing, completed, failed
  
  -- 元数据
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 索引
  INDEX idx_file_project (project_id),
  INDEX idx_file_workflow (workflow_id)
);
```

**9. 会话表 (sessions) - Redis备选**
```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash VARCHAR(255) NOT NULL,
  
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  INDEX idx_session_user (user_id),
  INDEX idx_session_expires (expires_at)
);
```

#### 索引策略
```sql
-- 性能优化索引
CREATE INDEX idx_workflow_project ON workflows(project_id);
CREATE INDEX idx_workflow_creator ON workflows(created_by);
CREATE INDEX idx_workflow_template ON workflows(is_template) WHERE is_template = true;

CREATE INDEX idx_execution_workflow ON execution_history(workflow_id);
CREATE INDEX idx_execution_user ON execution_history(executed_by);
CREATE INDEX idx_execution_status_time ON execution_history(status, created_at);

CREATE INDEX idx_node_log_execution ON node_execution_logs(execution_id);
CREATE INDEX idx_node_log_status ON node_execution_logs(status);

CREATE INDEX idx_project_owner ON projects(owner_id);
CREATE INDEX idx_project_status ON projects(status);
```

---

### Day 2-3: Prisma ORM集成

#### 安装依赖
```bash
cd packages/backend
npm install prisma @prisma/client
npm install -D prisma
```

#### Prisma Schema
```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  username      String    @unique
  email         String    @unique
  passwordHash  String    @map("password_hash")
  displayName   String?   @map("display_name")
  avatarUrl     String?   @map("avatar_url")
  role          String    @default("user")
  status        String    @default("active")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  lastLoginAt   DateTime? @map("last_login_at")
  
  // Relations
  ownedProjects    Project[]         @relation("ProjectOwner")
  projectMembers   ProjectMember[]
  workflows        Workflow[]        @relation("WorkflowCreator")
  executions       ExecutionHistory[]
  auditLogs        AuditLog[]
  files            File[]
  sessions         Session[]
  
  @@map("users")
}

// 其他模型定义...
```

#### Repository模式
```typescript
// repositories/BaseRepository.ts
export abstract class BaseRepository<T> {
  constructor(protected prisma: PrismaClient) {}
  
  abstract findById(id: string): Promise<T | null>;
  abstract create(data: any): Promise<T>;
  abstract update(id: string, data: any): Promise<T>;
  abstract delete(id: string): Promise<void>;
}

// repositories/UserRepository.ts
export class UserRepository extends BaseRepository<User> {
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }
  
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }
  
  // ... 更多方法
}
```

---

### Day 4: Redis缓存层

#### 缓存策略
```typescript
// services/CacheService.ts
export class CacheService {
  private redis: Redis;
  
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// 缓存键规范
const CACHE_KEYS = {
  workflow: (id: string) => `workflow:${id}`,
  workflowList: (projectId: string) => `workflows:project:${projectId}`,
  user: (id: string) => `user:${id}`,
  session: (token: string) => `session:${token}`,
  executionStatus: (taskId: string) => `execution:${taskId}:status`,
};
```

---

### Day 5: 数据迁移脚本

#### 从内存到数据库
```typescript
// scripts/migrate-data.ts
async function migrateWorkflows() {
  const inMemoryWorkflows = Array.from(workflows.values());
  
  for (const workflow of inMemoryWorkflows) {
    await prisma.workflow.create({
      data: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        category: workflow.category,
        nodes: workflow.nodes,
        edges: workflow.edges,
        createdBy: 'system-admin', // 默认创建者
        // ...
      }
    });
  }
  
  console.log(`Migrated ${inMemoryWorkflows.length} workflows`);
}
```

---

## 🎯 阶段2: 用户认证系统 (Day 6-10)

### Day 6-7: JWT认证

#### 认证服务
```typescript
// services/AuthService.ts
export class AuthService {
  async login(email: string, password: string) {
    const user = await userRepo.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new UnauthorizedError('Invalid credentials');
    }
    
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    await this.createSession(user.id, token);
    return { token, user };
  }
  
  async register(data: RegisterDto) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await userRepo.create({
      ...data,
      passwordHash
    });
    
    return user;
  }
  
  async verifyToken(token: string) {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    return payload;
  }
}
```

### Day 8-9: RBAC权限系统

#### 权限定义
```typescript
// permissions/definitions.ts
export const PERMISSIONS = {
  // 工作流权限
  'workflow:create': ['admin', 'auditor'],
  'workflow:read': ['admin', 'auditor', 'user'],
  'workflow:update': ['admin', 'auditor'],
  'workflow:delete': ['admin'],
  'workflow:execute': ['admin', 'auditor', 'user'],
  
  // 项目权限
  'project:create': ['admin', 'auditor'],
  'project:read': ['admin', 'auditor', 'user'],
  'project:update': ['admin', 'auditor'],
  'project:delete': ['admin'],
  
  // 用户管理
  'user:create': ['admin'],
  'user:read': ['admin'],
  'user:update': ['admin'],
  'user:delete': ['admin'],
};

// middleware/authorize.ts
export function authorize(...permissions: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const hasPermission = permissions.some(perm => 
      PERMISSIONS[perm]?.includes(user.role)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
}
```

### Day 10: 测试和集成

---

## 🎯 阶段3: 项目管理模块 (Day 11-15)

### API设计
```typescript
// 项目CRUD
POST   /api/projects          - 创建项目
GET    /api/projects          - 项目列表
GET    /api/projects/:id      - 项目详情
PUT    /api/projects/:id      - 更新项目
DELETE /api/projects/:id      - 删除项目

// 项目成员
POST   /api/projects/:id/members      - 添加成员
GET    /api/projects/:id/members      - 成员列表
PUT    /api/projects/:id/members/:uid - 更新成员角色
DELETE /api/projects/:id/members/:uid - 移除成员

// 项目工作流
GET    /api/projects/:id/workflows    - 项目工作流列表
```

---

## 🎯 阶段4: 审计日志和文件服务 (Day 16-20)

### 审计日志中间件
```typescript
// middleware/auditLog.ts
export function auditLog(action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', async () => {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action,
          resourceType: req.params.resourceType,
          resourceId: req.params.id,
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: Date.now() - startTime,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      });
    });
    
    next();
  };
}
```

---

## 🎯 阶段5: 部署和上线 (Day 21-25)

### Docker配置
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/audit
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
  
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: audit
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 📊 进度跟踪

### 里程碑
- [ ] Day 5: 数据持久化完成
- [ ] Day 10: 用户系统完成
- [ ] Day 15: 项目管理完成
- [ ] Day 20: 审计日志完成
- [ ] Day 25: 生产环境就绪

### 风险管理
| 风险 | 影响 | 应对 |
|------|------|------|
| 数据迁移失败 | 高 | 备份 + 回滚方案 |
| 性能问题 | 中 | 索引优化 + 缓存 |
| 权限漏洞 | 高 | 安全审计 + 测试 |

---

**开始执行**: Day 1 - 数据库设计 ⏳
