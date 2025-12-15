@echo off
REM Docker Compose Quick Start Script for Audit Intelligence v2 (Windows)

echo ========================================
echo Starting Audit Intelligence v2...
echo ========================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo WARNING: .env file not found. Creating from .env.example...
    copy .env.example .env
    echo SUCCESS: Created .env file
    echo WARNING: Please edit .env and set JWT_SECRET before production deployment!
    echo.
)

REM Create storage directories
echo Creating storage directories...
if not exist "storage\projects" mkdir storage\projects
if not exist "storage\cache" mkdir storage\cache
if not exist "storage\backups" mkdir storage\backups
echo SUCCESS: Storage directories created
echo.

REM Build and start containers
echo Building Docker images...
docker-compose build

echo.
echo Starting containers...
docker-compose up -d

echo.
echo Waiting for services to be ready...
timeout /t 5 /nobreak > nul

echo.
echo ========================================
echo Audit Intelligence v2 is running!
echo ========================================
echo.
echo Access points:
echo    Frontend:  http://localhost:80
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo.
echo Default login:
echo    Username:  admin
echo    Password:  0000
echo    WARNING: Change password after first login!
echo.
echo View logs:
echo    docker-compose logs -f
echo.
echo Stop services:
echo    docker-compose down
echo.
pause
