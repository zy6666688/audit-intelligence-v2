# PowerShell script to start the backend server
# Usage: .\start_backend.ps1

$ErrorActionPreference = "Stop"

# Set console encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Audit Intelligence v2 - Backend Server" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"

# Change to backend directory
Set-Location $backendDir

# Check for virtual environment
$venvPath = Join-Path $backendDir "venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "[ERROR] Virtual environment not found at $venvPath" -ForegroundColor Red
    Write-Host "Please run 'python -m venv venv' in the backend directory first." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Activate virtual environment
Write-Host "[INFO] Activating virtual environment..." -ForegroundColor Green
& "$venvPath\Scripts\Activate.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to activate virtual environment." -ForegroundColor Red
    Write-Host "You may need to run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Upgrade pip
Write-Host "[INFO] Upgrading pip..." -ForegroundColor Green
python -m pip install --upgrade pip -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Failed to upgrade pip, continuing anyway..." -ForegroundColor Yellow
}

# Install dependencies
Write-Host "[INFO] Installing dependencies..." -ForegroundColor Green
python -m pip install -r requirements.txt -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start uvicorn server
Write-Host ""
Write-Host "[INFO] Starting backend server..." -ForegroundColor Green
Write-Host "Backend will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API docs will be available at: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start uvicorn with proper app module
# 排除一些不必要的文件变化检测，减少重载警告
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --reload-exclude "*.pyc" --reload-exclude "__pycache__" --reload-exclude "*.pyo"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Backend server failed to start." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

