@echo off
chcp 65001 >nul
echo ========================================
echo 推送到 shengji2 仓库
echo ========================================
echo.

REM 检查当前分支
for /f "tokens=2" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" (
    echo 错误: 无法获取当前分支
    pause
    exit /b 1
)

if not "%CURRENT_BRANCH%"=="audit-workflow-fixes" (
    echo 警告: 当前分支是 %CURRENT_BRANCH%，不是 audit-workflow-fixes
    set /p CONFIRM="是否切换到 audit-workflow-fixes 分支? (y/n): "
    if /i "%CONFIRM%"=="y" (
        git checkout audit-workflow-fixes
        if errorlevel 1 (
            echo 切换分支失败
            pause
            exit /b 1
        )
    ) else (
        echo 已取消操作
        pause
        exit /b 0
    )
)

echo.
echo 当前分支: audit-workflow-fixes
echo.
echo 最近的提交:
git log --oneline -5
echo.

REM 读取 token
set /p TOKEN="请输入你的 GitHub Personal Access Token: "
if "%TOKEN%"=="" (
    echo 错误: Token 不能为空
    pause
    exit /b 1
)

echo.
echo 正在配置远程仓库 URL...
git remote set-url shengji2 https://%TOKEN%@github.com/Gabriella-ch/shengji2.git
if errorlevel 1 (
    echo 错误: 配置远程仓库失败
    pause
    exit /b 1
)

echo.
echo 正在推送分支...
git push -u shengji2 audit-workflow-fixes

if errorlevel 1 (
    echo.
    echo ========================================
    echo 推送失败！
    echo ========================================
    echo.
    echo 可能的原因:
    echo 1. Token 无效或已过期
    echo 2. Token 权限不足（需要 repo 权限）
    echo 3. 没有仓库写入权限
    echo.
    echo 解决方案:
    echo 1. 检查 Token 是否正确
    echo 2. 确认 Token 有 repo 权限
    echo 3. 联系仓库所有者获取写入权限
    echo 4. 或使用 Fork + Pull Request 方式
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo 推送成功！
    echo ========================================
    echo.
    echo 分支地址:
    echo https://github.com/Gabriella-ch/shengji2/tree/audit-workflow-fixes
    echo.
    echo 注意: Token 已保存在 Windows Credential Manager 中
    echo 如需清除，运行: git remote set-url shengji2 https://github.com/Gabriella-ch/shengji2.git
    echo.
    pause
)





