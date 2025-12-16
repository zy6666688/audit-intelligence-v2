@echo off
chcp 65001 >nul 2>&1
echo ========================================================
echo   Backend Status Check
echo ========================================================
echo.

echo [1] Checking if backend is running...
curl -s http://localhost:8000/health/ready >nul 2>&1
if errorlevel 1 (
    echo    [FAIL] Backend is not running or not accessible
    echo.
    echo    Please start the backend:
    echo    1. Run: start_backend.bat
    echo    2. Or run: run_dev.bat (starts both frontend and backend)
    echo.
) else (
    echo    [OK] Backend is running
    echo.
    echo [2] Testing preview API...
    curl -s http://localhost:8000/preview/node/test/test/0 >nul 2>&1
    if errorlevel 1 (
        echo    [WARN] Preview API endpoint exists but may require authentication
    ) else (
        echo    [OK] Preview API is accessible
    )
    echo.
    echo [3] Backend API Documentation:
    echo    http://localhost:8000/docs
    echo.
)

echo ========================================================
pause

