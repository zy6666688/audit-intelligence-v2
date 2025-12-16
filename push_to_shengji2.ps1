# 推送到 shengji2 仓库的脚本
# 使用方法: .\push_to_shengji2.ps1 [YOUR_TOKEN]

param(
    [string]$Token = ""
)

Write-Host "=== 推送到 shengji2 仓库 ===" -ForegroundColor Cyan
Write-Host ""

# 检查分支
$currentBranch = git branch --show-current
if ($currentBranch -ne "audit-workflow-fixes") {
    Write-Host "警告: 当前分支是 '$currentBranch'，不是 'audit-workflow-fixes'" -ForegroundColor Yellow
    $confirm = Read-Host "是否切换到 audit-workflow-fixes 分支? (y/n)"
    if ($confirm -eq "y") {
        git checkout audit-workflow-fixes
    } else {
        Write-Host "已取消操作" -ForegroundColor Red
        exit 1
    }
}

# 检查远程仓库
$remoteUrl = git remote get-url shengji2 2>$null
if (-not $remoteUrl) {
    Write-Host "错误: 未找到 shengji2 远程仓库" -ForegroundColor Red
    Write-Host "正在添加远程仓库..." -ForegroundColor Yellow
    git remote add shengji2 https://github.com/Gabriella-ch/shengji2.git
}

# 如果有 token，更新 URL
if ($Token) {
    Write-Host "使用 Personal Access Token 配置远程 URL..." -ForegroundColor Yellow
    $newUrl = "https://$Token@github.com/Gabriella-ch/shengji2.git"
    git remote set-url shengji2 $newUrl
    Write-Host "已更新远程 URL（使用 token）" -ForegroundColor Green
} else {
    Write-Host "未提供 token，将使用 Windows Credential Manager 或提示输入凭证" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "如果需要使用 token，请运行:" -ForegroundColor Cyan
    Write-Host "  .\push_to_shengji2.ps1 -Token YOUR_TOKEN" -ForegroundColor White
    Write-Host ""
}

# 检查是否有未提交的更改
$status = git status --porcelain
if ($status) {
    Write-Host "检测到未提交的更改:" -ForegroundColor Yellow
    Write-Host $status
    $confirm = Read-Host "是否先提交这些更改? (y/n)"
    if ($confirm -eq "y") {
        git add -A
        $commitMsg = Read-Host "请输入提交信息"
        if ($commitMsg) {
            git commit -m $commitMsg
        } else {
            git commit -m "chore: Update before push to shengji2"
        }
    }
}

# 显示当前分支和提交信息
Write-Host ""
Write-Host "当前分支: $currentBranch" -ForegroundColor Cyan
Write-Host "最近的提交:" -ForegroundColor Cyan
git log --oneline -5

Write-Host ""
$confirm = Read-Host "确认推送到 shengji2/audit-workflow-fixes? (y/n)"
if ($confirm -ne "y") {
    Write-Host "已取消操作" -ForegroundColor Yellow
    exit 0
}

# 执行推送
Write-Host ""
Write-Host "正在推送..." -ForegroundColor Yellow
try {
    git push -u shengji2 audit-workflow-fixes
    Write-Host ""
    Write-Host "✅ 推送成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "分支地址: https://github.com/Gabriella-ch/shengji2/tree/audit-workflow-fixes" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "❌ 推送失败: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能的解决方案:" -ForegroundColor Yellow
    Write-Host "1. 使用 Personal Access Token:" -ForegroundColor White
    Write-Host "   .\push_to_shengji2.ps1 -Token YOUR_TOKEN" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 检查是否有仓库访问权限" -ForegroundColor White
    Write-Host ""
    Write-Host "3. 使用 Fork + Pull Request 方式:" -ForegroundColor White
    Write-Host "   - Fork 仓库: https://github.com/Gabriella-ch/shengji2" -ForegroundColor Gray
    Write-Host "   - 推送到你的 Fork" -ForegroundColor Gray
    Write-Host "   - 创建 Pull Request" -ForegroundColor Gray
    exit 1
}





