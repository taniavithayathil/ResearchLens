@echo off
setlocal enabledelayedexpansion

echo ==========================================================
echo         Starting ResearchLens (Backend + Frontend)
echo ==========================================================
echo.

:: 1. Start Database Containers (optional)
echo [1/3] Starting Database Containers...
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker not found. Will use SQLite fallback.
) else (
    docker compose up -d >nul 2>&1 || docker-compose up -d >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Database containers running on port 5433.
    ) else (
        echo [WARNING] Could not start Docker containers. Will use SQLite fallback.
    )
)

:: 2. Start Backend
echo.
echo [2/3] Launching Backend (FastAPI on port 8000)...
if not exist "backend\venv" (
    echo Creating virtual environment...
    python -m venv backend\venv 2>nul || py -m venv backend\venv
)
start "ResearchLens - Backend (Port 8000)" cmd /k "cd /d %~dp0backend && venv\Scripts\python.exe -m pip install -r requirements.txt -q && venv\Scripts\python.exe main.py"

:: 3. Start Frontend
echo.
echo [3/3] Launching Frontend (Next.js on port 3000)...
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && npm install && cd ..
)
start "ResearchLens - Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ==========================================================
echo  ResearchLens is starting up!
echo ==========================================================
echo  - Frontend:        http://localhost:3000
echo  - Backend API:     http://localhost:8000/docs
echo  - Health check:    http://localhost:8000/health
echo ==========================================================
echo.
echo  Wait ~5 seconds for both servers to initialize.
echo  (Close those windows to stop the servers.)
timeout /t 3 >nul
