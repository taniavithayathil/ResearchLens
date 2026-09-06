@echo off
echo ====================================================
echo Starting ResearchLens Setup and Execution
echo ====================================================

echo [1/4] Starting Database and Cache Containers...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker containers. Make sure Docker Desktop is running.
    pause
    exit /b %errorlevel%
)
echo Containers started successfully.

echo.
echo [2/4] Setting up Backend...
cd backend
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)
echo Installing Backend Dependencies...
call venv\Scripts\activate
pip install -r requirements.txt
echo Starting FastAPI Backend in a new window...
start cmd /k "title FastAPI Backend && call venv\Scripts\activate && uvicorn main:app --reload --port 8000"
cd ..

echo.
echo [3/4] Checking Frontend...
if not exist "frontend\package.json" (
    echo [INFO] Next.js frontend not found. Generating...
    call npx -y create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
)

echo.
echo [4/4] Starting Frontend...
cd frontend
echo Installing Frontend Dependencies...
call npm install
echo Starting Next.js Frontend in a new window...
start cmd /k "title Next.js Frontend && npm run dev"
cd ..

echo.
echo ====================================================
echo ResearchLens is starting!
echo Backend API available at: http://localhost:8000/docs
echo Frontend available at: http://localhost:3000
echo ====================================================
pause
