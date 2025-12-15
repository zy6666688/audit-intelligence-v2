@echo off
cd /d "%~dp0"

echo ========================================================
echo   Frontend Setup Diagnostic Tool
echo ========================================================
echo.

REM Check Node.js
echo [1] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo    [FAIL] Node.js not found in PATH
    exit /b 1
) else (
    echo    [OK] Node.js found
    node --version
)

REM Check npm
echo.
echo [2] Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo    [FAIL] npm not found in PATH
    exit /b 1
) else (
    echo    [OK] npm found
    npm --version
)

REM Check package.json
echo.
echo [3] Checking package.json...
if not exist "package.json" (
    echo    [FAIL] package.json not found
    echo    Current directory: %CD%
    exit /b 1
) else (
    echo    [OK] package.json found
)

REM Check node_modules
echo.
echo [4] Checking node_modules...
if not exist "node_modules" (
    echo    [WARN] node_modules directory not found
    echo    [INFO] Running npm install...
    call npm install
    if errorlevel 1 (
        echo    [FAIL] npm install failed
        exit /b 1
    )
) else (
    echo    [OK] node_modules directory exists
)

REM Check vite
echo.
echo [5] Checking Vite installation...
if not exist "node_modules\vite" (
    echo    [WARN] Vite not found in node_modules
    echo    [INFO] Running npm install...
    call npm install
    if errorlevel 1 (
        echo    [FAIL] npm install failed
        exit /b 1
    )
) else (
    echo    [OK] Vite found
)

REM Test npm run dev (dry run)
echo.
echo [6] Testing npm scripts...
call npm run --silent 2>nul
if errorlevel 1 (
    echo    [WARN] Could not list npm scripts
) else (
    echo    [OK] npm scripts available
)

echo.
echo ========================================================
echo   Diagnostic complete
echo ========================================================
echo.
echo If all checks passed, try running start_frontend.bat
pause

