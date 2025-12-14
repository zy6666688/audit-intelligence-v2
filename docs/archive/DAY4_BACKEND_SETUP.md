# Day 4 后端设置指南

## 📦 安装依赖

```bash
cd packages/backend

# 安装文件上传相关依赖
npm install multer @types/multer uuid

# 生成Prisma Client（更新File模型）
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev --name add_file_fields
```

## 🔧 配置环境变量

在 `packages/backend/.env` 中添加：

```env
# 文件上传配置
UPLOAD_DIR=./uploads
BASE_URL=http://localhost:3000
```

## 📝 创建的文件

1. ✅ `src/services/FileStorageService.ts` - 文件存储服务
2. ✅ `src/repositories/FileRepository.ts` - 文件数据访问层
3. ✅ `src/routes/fileRoutes.ts` - 文件API路由
4. ✅ 更新 `prisma/schema.prisma` - 添加File模型字段

## 🚀 集成到主应用

编辑 `packages/backend/src/index.ts`：

```typescript
import fileRoutes from './routes/fileRoutes';

// 在其他路由之后添加
app.use('/api/files', fileRoutes);
```

## 📊 API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/files/upload` | 上传单个文件 |
| POST | `/api/files/upload-multiple` | 上传多个文件 |
| GET | `/api/files` | 获取文件列表 |
| GET | `/api/files/:id` | 获取文件详情 |
| GET | `/api/files/download/:id` | 下载文件 |
| PATCH | `/api/files/:id` | 更新文件信息 |
| DELETE | `/api/files/:id` | 删除文件 |
| GET | `/api/files/stats/overview` | 获取文件统计 |

## ✅ 测试步骤

1. 启动后端服务：`npm run dev`
2. 使用Postman测试文件上传
3. 验证文件存储在 `uploads/` 目录
4. 检查数据库中的file记录
