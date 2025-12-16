@echo off
cd /d "%~dp0"

echo ========================================================
echo   Audit Intelligence v2 - Development Launcher
echo ========================================================
echo.

REM Check and create virtual environment if needed
if not exist "backend\venv\Scripts\python.exe" (
    echo [INFO] Creating virtual environment...
    cd backend
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        echo Please ensure Python is installed and in PATH.
        pause
        exit /b 1
    )
    cd ..
)

REM Start Backend Server
echo [1/2] Starting Backend Server...
start "Backend Server" cmd /c "%~dp0start_backend.bat"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start Frontend Server
echo [2/2] Starting Frontend Server...
REM Try PowerShell script first, fallback to batch file
if exist "%~dp0start_frontend.ps1" (
    start "Frontend Server" powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0start_frontend.ps1"
) else (
    start "Frontend Server" cmd /k "%~dp0start_frontend.bat"
)

echo.
echo ========================================================
echo   Servers are starting in new windows.
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000/docs
echo ========================================================
pause
