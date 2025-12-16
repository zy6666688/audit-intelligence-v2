@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ========================================================
echo   Frontend Server - Starting...
echo ========================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is available
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    echo Please ensure Node.js is properly installed.
    pause
    exit /b 1
)

REM Display Node.js and npm versions
echo [INFO] Node.js version:
node --version
if errorlevel 1 (
    echo [ERROR] Failed to get Node.js version
    pause
    exit /b 1
)

echo [INFO] npm version:
npm --version
if errorlevel 1 (
    echo [ERROR] Failed to get npm version
    pause
    exit /b 1
)
echo.
echo [DEBUG] Continuing to next step...
echo.

REM Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json not found in current directory.
    echo Current directory: %CD%
    pause
    exit /b 1
)
echo [OK] package.json found
echo.

REM Install dependencies
echo [1/2] Installing dependencies...
echo Current directory: %CD%
echo.
echo Running: npm install
echo.
npm install
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo.
    echo Please check:
    echo   1. Internet connection
    echo   2. npm registry access
    echo   3. Disk space
    echo   4. File permissions
    echo.
    echo You can try manually: npm install
    echo.
    pause
    exit /b 1
)
echo.
echo [OK] Dependencies installed successfully.
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] node_modules directory was not created.
    echo npm install may have failed silently.
    pause
    exit /b 1
)

REM Check if vite is installed
if not exist "node_modules\vite" (
    echo [ERROR] Vite is not installed in node_modules.
    echo Please run: npm install
    pause
    exit /b 1
)
echo [OK] Vite is installed
echo.

REM Start development server
echo [2/2] Starting development server...
echo [INFO] Frontend will be available at: http://localhost:5173
echo [INFO] Press Ctrl+C to stop the server
echo.
echo Running: npm run dev
echo.
npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start development server.
    echo.
    echo Possible causes:
    echo   1. Port 5173 is already in use
    echo   2. Vite configuration error
    echo   3. TypeScript compilation error
    echo   4. Missing dependencies
    echo.
    echo You can try manually: npm run dev
    echo.
    pause
    exit /b 1
)

pause

