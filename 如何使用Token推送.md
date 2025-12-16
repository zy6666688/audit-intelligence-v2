# 如何使用 Personal Access Token 推送到 shengji2 仓库

## 快速步骤

### 1. 生成 Personal Access Token

1. 访问 GitHub Token 设置页面：
   ```
   https://github.com/settings/tokens
   ```

2. 点击 **"Generate new token"** → **"Generate new token (classic)"**

3. 填写 Token 信息：
   - **Note（备注）**: `shengji2-push-token`（任意名称）
   - **Expiration（过期时间）**: 选择合适的时间（建议 90 天或自定义）
   - **Select scopes（权限范围）**: 
     - ✅ 勾选 **`repo`**（完整仓库访问权限）
     - ✅ 勾选 **`workflow`**（如果需要）

4. 点击 **"Generate token"**

5. **重要**: 立即复制生成的 token（只显示一次！）
   ```
   例如: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 2. 使用 Token 推送

#### 方法 A: 使用命令行（推荐）

打开 PowerShell 或 CMD，执行以下命令：

```powershell
# 替换 YOUR_TOKEN 为你的实际 token
$token = "YOUR_TOKEN"

# 更新远程仓库 URL，包含 token
git remote set-url shengji2 https://$token@github.com/Gabriella-ch/shengji2.git

# 推送分支
git push -u shengji2 audit-workflow-fixes
```

#### 方法 B: 使用批处理脚本

1. 创建文件 `push_with_token.bat`，内容如下：

```batch
@echo off
set /p TOKEN="请输入你的 GitHub Personal Access Token: "
git remote set-url shengji2 https://%TOKEN%@github.com/Gabriella-ch/shengji2.git
git push -u shengji2 audit-workflow-fixes
pause
```

2. 双击运行 `push_with_token.bat`
3. 输入你的 token
4. 等待推送完成

#### 方法 C: 使用 PowerShell 脚本

1. 运行以下命令：

```powershell
# 读取 token（输入时不会显示）
$secureToken = Read-Host "请输入你的 GitHub Personal Access Token" -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken))

# 更新远程 URL
git remote set-url shengji2 "https://$token@github.com/Gabriella-ch/shengji2.git"

# 推送
git push -u shengji2 audit-workflow-fixes
```

### 3. 验证推送成功

推送成功后，访问以下链接查看分支：
```
https://github.com/Gabriella-ch/shengji2/tree/audit-workflow-fixes
```

## 安全提示

⚠️ **重要安全注意事项**：

1. **Token 保密**: 
   - 不要将 token 提交到 Git 仓库
   - 不要分享 token 给他人
   - 如果 token 泄露，立即撤销并重新生成

2. **Token 存储**:
   - Windows Credential Manager 会自动保存 token
   - 如果不想保存，推送后可以重置远程 URL：
     ```bash
     git remote set-url shengji2 https://github.com/Gabriella-ch/shengji2.git
     ```

3. **Token 权限**:
   - 只授予必要的权限（`repo` 即可）
   - 定期检查并撤销不需要的 token

## 替代方案：Fork + Pull Request

如果无法获取写入权限，可以使用 Fork 方式：

### 步骤：

1. **Fork 仓库**:
   - 访问: https://github.com/Gabriella-ch/shengji2
   - 点击右上角 **"Fork"** 按钮

2. **添加你的 Fork 为远程仓库**:
   ```bash
   git remote add myfork https://github.com/YOUR_USERNAME/shengji2.git
   ```

3. **推送到你的 Fork**:
   ```bash
   git push -u myfork audit-workflow-fixes
   ```

4. **创建 Pull Request**:
   - 访问: https://github.com/Gabriella-ch/shengji2
   - 点击 **"Compare & pull request"**
   - 填写 PR 标题和说明
   - 点击 **"Create pull request"**

## 故障排除

### 问题 1: 403 Forbidden
- **原因**: Token 无效或权限不足
- **解决**: 
  - 检查 token 是否正确
  - 确认 token 有 `repo` 权限
  - 检查 token 是否过期

### 问题 2: 401 Unauthorized
- **原因**: Token 格式错误
- **解决**: 
  - 确认 token 以 `ghp_` 开头
  - 检查 URL 格式是否正确

### 问题 3: 推送后看不到分支
- **原因**: 可能需要刷新页面
- **解决**: 
  - 等待几秒钟后刷新 GitHub 页面
  - 检查是否正确推送到目标仓库

## 当前分支信息

- **分支名称**: `audit-workflow-fixes`
- **目标仓库**: `shengji2` (https://github.com/Gabriella-ch/shengji2.git)
- **最新提交**: `5346b32 Merge branch 'main' of https://github.com/zy6666688/SHENJI`

## 需要帮助？

如果遇到问题，可以：
1. 检查 `BRANCH_DESCRIPTION.md` 了解分支内容
2. 查看 `PUSH_INSTRUCTIONS.md` 获取更多推送选项
3. 联系仓库所有者获取写入权限





