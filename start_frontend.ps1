# Frontend Server Startup Script (PowerShell)
# This script is more reliable in PowerShell environment

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Frontend Server - Starting..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "[INFO] Current directory: $scriptDir" -ForegroundColor Yellow
Write-Host ""

# Check if Node.js is installed
Write-Host "[1/6] Checking Node.js..." -ForegroundColor Green
try {
    $nodeVersion = node --version
    Write-Host "  [OK] Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "  Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Check if npm is available
Write-Host "[2/6] Checking npm..." -ForegroundColor Green
try {
    $npmVersion = npm --version
    Write-Host "  [OK] npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] npm is not installed or not in PATH." -ForegroundColor Red
    Write-Host "  Please ensure Node.js is properly installed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Check if package.json exists
Write-Host "[3/6] Checking package.json..." -ForegroundColor Green
if (-not (Test-Path "package.json")) {
    Write-Host "  [ERROR] package.json not found in current directory." -ForegroundColor Red
    Write-Host "  Current directory: $(Get-Location)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  [OK] package.json found" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "[4/6] Installing dependencies..." -ForegroundColor Green
Write-Host "  Running: npm install" -ForegroundColor Yellow
Write-Host ""
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }
    Write-Host ""
    Write-Host "  [OK] Dependencies installed successfully." -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  [ERROR] Failed to install dependencies." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please check:" -ForegroundColor Yellow
    Write-Host "    1. Internet connection" -ForegroundColor Yellow
    Write-Host "    2. npm registry access" -ForegroundColor Yellow
    Write-Host "    3. Disk space" -ForegroundColor Yellow
    Write-Host "    4. File permissions" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  You can try manually: npm install" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Check if node_modules exists
Write-Host "[5/6] Verifying installation..." -ForegroundColor Green
if (-not (Test-Path "node_modules")) {
    Write-Host "  [ERROR] node_modules directory was not created." -ForegroundColor Red
    Write-Host "  npm install may have failed silently." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path "node_modules\vite")) {
    Write-Host "  [ERROR] Vite is not installed in node_modules." -ForegroundColor Red
    Write-Host "  Please run: npm install" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Vite is installed" -ForegroundColor Green
Write-Host ""

# Start development server
Write-Host "[6/6] Starting development server..." -ForegroundColor Green
Write-Host "  [INFO] Frontend will be available at: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  [INFO] Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Running: npm run dev" -ForegroundColor Yellow
Write-Host ""

try {
    npm run dev
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  [ERROR] Failed to start development server." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Possible causes:" -ForegroundColor Yellow
        Write-Host "    1. Port 5173 is already in use" -ForegroundColor Yellow
        Write-Host "    2. Vite configuration error" -ForegroundColor Yellow
        Write-Host "    3. TypeScript compilation error" -ForegroundColor Yellow
        Write-Host "    4. Missing dependencies" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  You can try manually: npm run dev" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "  [ERROR] Failed to start development server: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

