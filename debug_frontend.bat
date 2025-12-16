@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================
echo   Frontend Debug Tool
echo ========================================================
echo.

echo [Step 1] Current Directory:
echo %CD%
echo.

echo [Step 2] Checking Node.js...
node --version
if errorlevel 1 (
    echo ERROR: Node.js not found
    pause
    exit /b 1
)
echo.

echo [Step 3] Checking npm...
npm --version
if errorlevel 1 (
    echo ERROR: npm not found
    pause
    exit /b 1
)
echo.

echo [Step 4] Checking package.json...
if not exist "package.json" (
    echo ERROR: package.json not found
    pause
    exit /b 1
)
echo OK: package.json exists
echo.

echo [Step 5] Checking node_modules...
if not exist "node_modules" (
    echo WARNING: node_modules not found
    echo Running npm install...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
) else (
    echo OK: node_modules exists
)
echo.

echo [Step 6] Checking Vite...
if not exist "node_modules\vite" (
    echo ERROR: Vite not found in node_modules
    echo Running npm install...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
) else (
    echo OK: Vite found
)
echo.

echo [Step 7] Testing npm run dev (will timeout after 10 seconds)...
echo Starting Vite dev server...
echo.
timeout /t 2 /nobreak >nul
start /B cmd /c "npm run dev > frontend_output.log 2>&1"
timeout /t 10 /nobreak >nul
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

if exist "frontend_output.log" (
    echo Output from npm run dev:
    echo ----------------------------------------
    type frontend_output.log
    echo ----------------------------------------
    del frontend_output.log
) else (
    echo WARNING: No output log generated
)
echo.

echo [Step 8] Checking if port 5173 is in use...
netstat -ano | findstr ":5173" >nul
if errorlevel 1 (
    echo OK: Port 5173 is available
) else (
    echo WARNING: Port 5173 might be in use
    netstat -ano | findstr ":5173"
)
echo.

echo ========================================================
echo   Debug complete
echo ========================================================
pause

