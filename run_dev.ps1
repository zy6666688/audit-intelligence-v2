# Audit Intelligence v2 - Development Launcher (PowerShell)
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Audit Intelligence v2 - Development Launcher" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check and create virtual environment if needed
if (-not (Test-Path "backend\venv\Scripts\python.exe")) {
    Write-Host "[INFO] Creating virtual environment..." -ForegroundColor Yellow
    Set-Location backend
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create virtual environment." -ForegroundColor Red
        Write-Host "Please ensure Python is installed and in PATH." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Set-Location ..
}

# Start Backend Server
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Green
$backendScript = Join-Path $scriptDir "start_backend.bat"
Start-Process cmd -ArgumentList "/k", "`"$backendScript`"" -WindowStyle Normal

# Wait a moment
Start-Sleep -Seconds 2

# Start Frontend Server
Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Green
$frontendScript = Join-Path $scriptDir "start_frontend.ps1"
if (Test-Path $frontendScript) {
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$frontendScript`"" -WindowStyle Normal
} else {
    $frontendBat = Join-Path $scriptDir "start_frontend.bat"
    Start-Process cmd -ArgumentList "/k", "`"$frontendBat`"" -WindowStyle Normal
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Servers are starting in new windows." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  Backend:  http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"

