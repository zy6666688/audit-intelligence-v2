@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    echo [ERROR] Virtual environment not found at venv\Scripts\activate.bat
    echo Please run 'python -m venv venv' in the backend directory first.
    pause
    exit /b 1
)
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip -q
if errorlevel 1 (
    echo [WARNING] Failed to upgrade pip, continuing anyway...
)
echo [INFO] Installing dependencies...
python -m pip install -r requirements.txt -q
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo.
echo [INFO] Starting backend server...
echo Backend will be available at: http://localhost:8000
echo API docs will be available at: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --reload-exclude "*.pyc" --reload-exclude "__pycache__" --reload-exclude "*.pyo"
if errorlevel 1 (
    echo.
    echo [ERROR] Backend server failed to start.
    pause
    exit /b 1
)
pause

