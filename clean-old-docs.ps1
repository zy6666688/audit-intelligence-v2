# 清理旧文档和临时文件
Write-Host "🗑️ 开始清理旧文档..." -ForegroundColor Cyan
Write-Host ""

$deletedCount = 0

# 删除旧架构文档
Write-Host "📁 清理docs/refactoring目录..." -ForegroundColor Yellow
if (Test-Path "docs/refactoring") {
    Remove-Item -Path "docs/refactoring" -Recurse -Force
    Write-Host "  ✓ 删除 docs/refactoring/" -ForegroundColor Green
    $deletedCount++
}

# 删除Vol系列文档
Write-Host "📁 清理Vol系列文档..." -ForegroundColor Yellow
$volDocs = @(
    "docs/Vol1_System_Architecture.md",
    "docs/Vol2_Node_Reference.md",
    "docs/Vol4_Developer_Guide.md",
    "docs/Vol4_Part1_Architecture.md",
    "docs/Vol4_Part2_Development.md"
)
foreach ($doc in $volDocs) {
    if (Test-Path $doc) {
        Remove-Item $doc -Force
        Write-Host "  ✓ 删除 $doc" -ForegroundColor Green
        $deletedCount++
    }
}

# 删除V4系列文档
Write-Host "📁 清理V4系列文档..." -ForegroundColor Yellow
Get-ChildItem -Path "docs" -Filter "V4*.md" | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "  ✓ 删除 $($_.Name)" -ForegroundColor Green
    $deletedCount++
}

# 删除临时文档
Write-Host "📁 清理临时文档..." -ForegroundColor Yellow
$tempDocs = @(
    "docs/AUDIT_ENGINE_MANUAL.md",
    "docs/AUDIT_WORKPAPER_RULES.md",
    "docs/Documentation_Evolution_Summary.md",
    "docs/Documentation_Index.md",
    "docs/Engineering_Refactoring_Plan.md",
    "docs/RULES_QUICK_REFERENCE.md",
    "docs/README_v4.1.md"
)
foreach ($doc in $tempDocs) {
    if (Test-Path $doc) {
        Remove-Item $doc -Force
        Write-Host "  ✓ 删除 $doc" -ForegroundColor Green
        $deletedCount++
    }
}

# 删除临时脚本
Write-Host "📁 清理临时脚本..." -ForegroundColor Yellow
$tempScripts = @(
    "scripts/setup-day1.bat",
    "scripts/setup-day1.sh",
    "scripts/setup-day2.bat",
    "scripts/start-day3.bat"
)
foreach ($script in $tempScripts) {
    if (Test-Path $script) {
        Remove-Item $script -Force
        Write-Host "  ✓ 删除 $script" -ForegroundColor Green
        $deletedCount++
    }
}

# 删除根目录临时文件
Write-Host "📁 清理根目录临时文件..." -ForegroundColor Yellow
$rootTemp = @(
    "FIXES_APPLIED.md",
    "PROJECT_DELIVERABLES.md",
    "PUSH_TO_REMOTE.md",
    "TYPE_FIXES.md",
    "CURRENT_STATUS.md"
)
foreach ($file in $rootTemp) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  ✓ 删除 $file" -ForegroundColor Green
        $deletedCount++
    }
}

Write-Host ""
Write-Host "✅ 清理完成！删除了 $deletedCount 个文件/目录" -ForegroundColor Green
Write-Host ""
Write-Host "📊 当前Git状态:" -ForegroundColor Cyan
git status --short | Select-Object -First 20
