# 快速开始指南

> **5分钟上手审计数智析 v2**

---

## 🎯 第一步：启动服务

### 方式一：Docker 部署（推荐）

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 设置 JWT_SECRET（必须）
# 编辑 .env，设置强随机密钥

# 3. 启动服务
./docker-start.sh  # Linux/Mac
docker-start.bat   # Windows
```

### 方式二：传统部署

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# 前端（新终端）
npm install
npm run dev
```

---

## 🔐 第二步：登录系统

1. 访问前端：http://localhost:5173
2. 使用默认账号登录：
   - **用户名**: `admin`
   - **密码**: `0000`
3. ⚠️ **首次登录后请立即修改密码！**

---

## 📊 第三步：创建第一个工作流

### 方法1：导入示例工作流

1. 点击工具栏的"导入"按钮
2. 选择 `backend/workflows/audit_mock_workflow.json`
3. 工作流会自动加载到画布

### 方法2：手动创建

1. 从左侧节点库拖拽节点到画布
2. 连接节点（从输出端口拖到输入端口）
3. 配置节点参数（点击节点打开属性面板）

---

## 🚀 第四步：运行工作流

1. 点击工具栏的"运行审计"按钮
2. 观察节点执行状态（灰色→黄色→绿色）
3. 点击节点上的 👁️ 图标查看数据预览
4. 查看生成的报告（位于 `backend/output/reports/`）

---

## 📖 下一步

- 📖 [查看完整工作流示例](./workflow-examples.md)
- 📖 [学习节点使用方法](../nodes/user-guide.md)
- 📖 [了解节点开发](../nodes/development-guide.md)

---

## ❓ 常见问题

### Q: 忘记管理员密码？
```bash
# 删除用户数据库，重新初始化
rm backend/storage/users.db
# 重启后端，会创建默认管理员 (admin/0000)
```

### Q: 如何查看节点输出？
- 执行工作流后，节点显示 👁️ 图标
- 点击图标打开底部数据预览面板

### Q: 如何导入数据？
- 使用 `FileUploadNode` 上传文件
- 或使用 `ExcelLoader` 直接加载文件路径

---

**需要帮助？** 查看 [完整文档索引](../README.md)

