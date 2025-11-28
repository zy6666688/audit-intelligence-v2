# 推送到远程仓库指南

## 📊 当前项目状态

- **总提交数**: 9个
- **总文件数**: 60+
- **代码行数**: ~7200行
- **文档行数**: ~5000行
- **分支**: master
- **状态**: ✅ 所有更改已提交，工作区干净

## 🎯 提交记录

```
f74d701 docs: 添加团队协作和Git工作流文档
f27378a docs: 添加详细的功能开发文档和路线图
abf528f fix: 修复tabbar图标显示异常
30b73f2 docs: 更新README添加快速开始指南
f537b70 docs: 添加内测报告
cd19a42 fix: 修复vite配置中的optimizeDeps错误
e740b72 feat: 补充API层和基础组件
eac193f fix: 修复request.ts中的TypeScript类型错误
eb00042 feat: 完成审计数智析基础框架搭建
```

---

## 🚀 推送步骤

### 步骤1: 在远程平台创建仓库

#### 选项A: GitHub

1. 访问 https://github.com/new
2. 填写仓库信息：
   - Repository name: `审计数智析` 或 `audit-ai-app`
   - Description: `基于uni-app的智能审计小程序系统`
   - **不要初始化**（不勾选README、.gitignore、License）
3. 点击 "Create repository"
4. 复制仓库地址，例如：
   ```
   https://github.com/你的用户名/audit-ai-app.git
   ```

#### 选项B: Gitee（国内推荐）

1. 访问 https://gitee.com/projects/new
2. 填写仓库信息：
   - 仓库名称: `audit-ai-app`
   - 介绍: `基于uni-app的智能审计小程序系统`
   - **不要初始化**
3. 点击 "创建"
4. 复制仓库地址

#### 选项C: GitLab

1. 访问 https://gitlab.com/projects/new
2. 创建项目
3. 复制仓库地址

#### 选项D: 公司内部Git服务器

询问IT部门获取Git服务器地址。

---

### 步骤2: 添加远程仓库

在项目目录下执行：

```bash
# 添加远程仓库（替换为您实际的仓库地址）
git remote add origin https://github.com/你的用户名/audit-ai-app.git

# 验证远程仓库
git remote -v
```

应该看到：
```
origin  https://github.com/你的用户名/audit-ai-app.git (fetch)
origin  https://github.com/你的用户名/audit-ai-app.git (push)
```

---

### 步骤3: 推送到远程仓库

```bash
# 首次推送（建立追踪关系）
git push -u origin master
```

如果遇到认证问题，根据平台选择：

#### GitHub认证

**方式1: HTTPS（推荐）**
- 使用Personal Access Token
- 在 Settings → Developer settings → Personal access tokens 创建
- 推送时使用Token作为密码

**方式2: SSH**
```bash
# 生成SSH密钥
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 复制公钥
cat ~/.ssh/id_rsa.pub

# 添加到GitHub: Settings → SSH and GPG keys
```

---

### 步骤4: 验证推送成功

```bash
# 查看远程分支
git branch -r

# 应该看到
origin/master
```

访问远程仓库网址，确认代码已上传。

---

## 👥 团队成员克隆仓库

### 其他成员获取代码

```bash
# 1. 克隆仓库
git clone https://github.com/你的用户名/audit-ai-app.git

# 2. 进入项目目录
cd audit-ai-app

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev:h5
```

---

## 🌿 创建develop分支（推荐）

为了保护master分支，建议创建develop分支用于日常开发：

```bash
# 1. 创建develop分支
git checkout -b develop

# 2. 推送develop分支到远程
git push -u origin develop

# 3. 设置develop为默认分支（在GitHub/GitLab网页上设置）
```

---

## 📋 后续推送流程

### 日常推送

```bash
# 1. 查看修改
git status

# 2. 添加修改
git add .

# 3. 提交
git commit -m "feat: 添加新功能"

# 4. 推送
git push
```

### 团队成员提交代码

```bash
# 1. 创建功能分支
git checkout -b feature/my-feature

# 2. 开发并提交
git add .
git commit -m "feat: 实现xxx功能"

# 3. 推送功能分支
git push -u origin feature/my-feature

# 4. 在GitHub/GitLab创建Pull Request/Merge Request
```

---

## 🔒 仓库设置建议

### 在GitHub/GitLab上设置

#### 1. 保护master分支
- Settings → Branches → Add rule
- Branch name pattern: `master`
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging

#### 2. 添加协作者
- Settings → Collaborators
- 添加团队成员的GitHub/GitLab账号

#### 3. 设置项目描述
- About → Edit
- Description: `基于uni-app开发的智能审计小程序系统，支持微信小程序和H5双端运行`
- Topics: `uni-app`, `vue3`, `typescript`, `audit`, `ai`

#### 4. 创建Issues模板
```yaml
name: Bug报告
about: 报告项目中的Bug
title: '[BUG] '
labels: bug
assignees: ''
```

---

## 📊 项目信息参考

### README徽章（可选）

在README.md顶部添加：

```markdown
# 审计数智析

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Uni-app](https://img.shields.io/badge/uni--app-3.0-green.svg)
![Vue](https://img.shields.io/badge/vue-3.3-brightgreen.svg)
```

### .gitattributes（可选）

创建 `.gitattributes` 文件：

```
# 自动规范化行尾
* text=auto

# 二进制文件
*.png binary
*.jpg binary
*.gif binary
*.pdf binary
```

---

## 🎉 完成！

推送成功后，您的团队成员就可以：

1. ✅ 克隆仓库开始开发
2. ✅ 创建功能分支
3. ✅ 提交Pull Request
4. ✅ 进行代码审查
5. ✅ 协作开发

---

## 📞 遇到问题？

### 常见问题

**Q: 推送被拒绝（rejected）**
```bash
# 先拉取远程代码
git pull origin master --allow-unrelated-histories
# 再推送
git push -u origin master
```

**Q: 认证失败**
- 检查用户名密码/Token是否正确
- 尝试使用SSH方式

**Q: 推送太慢**
- 检查网络
- 尝试使用国内镜像（Gitee）
- 使用代理

---

**创建日期**: 2024-11-28  
**适用场景**: 首次推送项目到远程仓库
