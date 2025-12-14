# Git 团队协作工作流

## 📋 仓库信息

- **项目名称**: 审计数智析
- **主分支**: `master`
- **当前提交**: 8个提交
- **代码行数**: ~7200行

---

## 🚀 首次推送到远程仓库

### 1. 添加远程仓库

```bash
# GitHub
git remote add origin https://github.com/你的用户名/审计数智析.git

# 或 Gitee
git remote add origin https://gitee.com/你的用户名/审计数智析.git

# 或 GitLab
git remote add origin https://gitlab.com/你的用户名/审计数智析.git

# 或公司内部Git服务器
git remote add origin http://git.company.com/审计数智析.git
```

### 2. 验证远程仓库

```bash
git remote -v
```

### 3. 推送到远程仓库

```bash
# 首次推送（建立追踪关系）
git push -u origin master

# 后续推送
git push
```

---

## 🌿 分支管理策略

### 分支命名规范

```
master              # 主分支（生产环境）
├── develop         # 开发分支（测试环境）
├── feature/xxx     # 功能分支
├── bugfix/xxx      # 缺陷修复分支
└── hotfix/xxx      # 紧急修复分支
```

### 分支创建示例

```bash
# 创建开发分支
git checkout -b develop

# 创建功能分支（从develop分出）
git checkout develop
git checkout -b feature/project-detail

# 创建修复分支
git checkout -b bugfix/fix-upload-issue

# 创建紧急修复分支（从master分出）
git checkout master
git checkout -b hotfix/critical-bug
```

---

## 👥 团队成员工作流程

### 新成员加入项目

```bash
# 1. 克隆仓库
git clone <远程仓库地址>
cd 审计数智析

# 2. 查看所有分支
git branch -a

# 3. 切换到开发分支
git checkout develop

# 4. 安装依赖
npm install

# 5. 启动开发服务器
npm run dev:h5
```

### 日常开发流程

#### Step 1: 创建功能分支

```bash
# 确保develop是最新的
git checkout develop
git pull origin develop

# 创建功能分支（以开发"项目详情"为例）
git checkout -b feature/project-detail
```

#### Step 2: 开发功能

```bash
# 编写代码...

# 查看修改
git status
git diff

# 提交更改
git add .
git commit -m "feat: 实现项目详情页面

- 添加项目信息展示
- 实现成员列表
- 添加统计卡片"
```

#### Step 3: 推送到远程

```bash
# 首次推送功能分支
git push -u origin feature/project-detail

# 后续推送
git push
```

#### Step 4: 创建合并请求（Pull Request/Merge Request）

1. 在GitHub/GitLab/Gitee上创建PR/MR
2. 选择 `feature/project-detail` → `develop`
3. 填写描述，关联Issue
4. 请求代码审查

#### Step 5: 代码审查与合并

- 审查人员查看代码
- 提出修改意见
- 开发人员修改并推送
- 审查通过后合并

#### Step 6: 删除已合并的分支

```bash
# 合并后删除本地分支
git checkout develop
git pull origin develop
git branch -d feature/project-detail

# 删除远程分支
git push origin --delete feature/project-detail
```

---

## 📝 提交信息规范

### 提交类型

```bash
feat:     新功能
fix:      修复bug
docs:     文档更新
style:    代码格式（不影响功能）
refactor: 重构
perf:     性能优化
test:     测试相关
chore:    构建/工具相关
```

### 提交信息示例

```bash
# ✅ 好的提交
git commit -m "feat: 添加项目详情页

- 实现项目基本信息展示
- 添加成员管理功能
- 集成统计数据API"

git commit -m "fix: 修复文件上传进度显示问题

关闭 #123"

# ❌ 不好的提交
git commit -m "修改了一些东西"
git commit -m "update"
```

---

## 🔄 常用场景处理

### 场景1: 同步远程最新代码

```bash
# 拉取最新代码
git checkout develop
git pull origin develop

# 如果有冲突
git status  # 查看冲突文件
# 手动解决冲突
git add .
git commit -m "fix: 解决合并冲突"
```

### 场景2: 合并其他分支的代码

```bash
# 当前在 feature/my-feature
# 需要合并 develop 的最新代码

git checkout develop
git pull origin develop
git checkout feature/my-feature
git merge develop

# 如果有冲突，解决后提交
git add .
git commit -m "merge: 合并develop最新代码"
git push
```

### 场景3: 暂存当前修改

```bash
# 临时需要切换分支，但当前修改还不想提交
git stash save "临时保存：正在开发的功能"

# 切换分支处理其他事情
git checkout other-branch
# ... 处理完成

# 回到原分支，恢复修改
git checkout feature/my-feature
git stash pop
```

### 场景4: 撤销错误的提交

```bash
# 撤销最后一次提交（保留修改）
git reset HEAD~1

# 撤销最后一次提交（丢弃修改）⚠️
git reset --hard HEAD~1

# 修正最后一次提交信息
git commit --amend -m "修正后的提交信息"
```

### 场景5: 查看提交历史

```bash
# 查看提交历史
git log --oneline --graph

# 查看某个文件的修改历史
git log --oneline -- src/pages/project/detail.vue

# 查看某次提交的详细内容
git show <commit-hash>
```

---

## 🎯 开发任务分配建议

### Sprint 1: 项目管理模块（Week 1-2）

**负责人A**: 
```bash
git checkout -b feature/project-detail
# 开发项目详情页
```

**负责人B**:
```bash
git checkout -b feature/project-form
# 开发项目创建/编辑表单
```

**负责人C**:
```bash
git checkout -b feature/member-manager
# 开发成员管理功能
```

### Sprint 2: 底稿模块（Week 3-4）

**负责人A**:
```bash
git checkout -b feature/workpaper-list
# 开发底稿列表
```

**负责人B**:
```bash
git checkout -b feature/node-editor
# 开发节点编辑器
```

---

## 🔒 保护分支设置

### GitHub/GitLab设置

在仓库设置中配置保护分支规则：

**master分支**:
- ✅ 禁止直接推送
- ✅ 必须通过PR/MR合并
- ✅ 至少1人审查
- ✅ CI/CD通过

**develop分支**:
- ✅ 禁止直接推送
- ✅ 必须通过PR/MR合并
- ✅ 可选审查

---

## 📊 代码审查检查清单

### 功能性
- [ ] 功能是否按需求实现
- [ ] 是否有遗漏的边界情况
- [ ] 错误处理是否完善

### 代码质量
- [ ] 命名是否清晰易懂
- [ ] 代码是否符合规范
- [ ] 是否有冗余代码
- [ ] 是否有注释（复杂逻辑）

### 性能
- [ ] 是否有性能问题
- [ ] 是否有不必要的重渲染
- [ ] API调用是否合理

### 安全
- [ ] 是否有安全隐患
- [ ] 敏感信息是否加密
- [ ] 用户输入是否验证

---

## 🚫 常见错误避免

### 1. 不要提交敏感信息

```bash
# ❌ 永远不要提交
.env                 # 环境变量
*.key                # 密钥文件
node_modules/        # 依赖包
*.log                # 日志文件
```

### 2. 不要在master直接开发

```bash
# ❌ 错误
git checkout master
# 直接在master上开发...

# ✅ 正确
git checkout -b feature/new-feature
# 在功能分支上开发
```

### 3. 提交前检查代码

```bash
# 检查TypeScript错误
npm run type-check

# 检查代码规范
npm run lint

# 运行测试
npm test
```

---

## 📞 获取帮助

### 遇到问题时

1. **查看文档**: 先查看本文档和Git官方文档
2. **询问团队**: 在团队群里提问
3. **GitHub Issues**: 提交问题到项目Issues
4. **Stack Overflow**: 搜索类似问题

### 常用Git学习资源

- Git官方文档: https://git-scm.com/doc
- Pro Git书籍: https://git-scm.com/book/zh/v2
- Git可视化学习: https://learngitbranching.js.org/?locale=zh_CN

---

## 📋 快速参考命令

```bash
# 克隆仓库
git clone <url>

# 查看状态
git status

# 拉取更新
git pull

# 创建分支
git checkout -b <branch-name>

# 提交更改
git add .
git commit -m "message"
git push

# 合并分支
git merge <branch-name>

# 查看历史
git log --oneline

# 暂存修改
git stash
git stash pop
```

---

**文档版本**: v1.0  
**创建日期**: 2024-11-28  
**适用团队规模**: 3-10人
