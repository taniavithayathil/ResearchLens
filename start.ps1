# ResearchLens Single-Command Launcher for PowerShell
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "        Starting ResearchLens (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = $PSScriptRoot

# 1. Start Docker Containers
Write-Host "[1/3] Starting Database Containers..." -ForegroundColor Yellow
try {
    docker compose up -d 2>$null
    if ($LASTEXITCODE -ne 0) {
        docker-compose up -d 2>$null
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Database containers running on port 5433." -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Could not start Docker. Will use SQLite fallback." -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "[WARNING] Docker not found. Will use SQLite fallback." -ForegroundColor DarkYellow
}

# 2. Start Backend
Write-Host ""
Write-Host "[2/3] Launching Backend (FastAPI on port 8000)..." -ForegroundColor Yellow
$BackendPath = Join-Path $RootPath "backend"
$VenvPath    = Join-Path $BackendPath "venv"
$PythonExe   = Join-Path $VenvPath "Scripts\python.exe"
$PipExe      = Join-Path $VenvPath "Scripts\pip.exe"
$ReqPath     = Join-Path $BackendPath "requirements.txt"

if (-not (Test-Path $VenvPath)) {
    Write-Host "Creating Python virtual environment..."
    # Try python then py
    if (Get-Command python -ErrorAction SilentlyContinue) {
        & python -m venv $VenvPath
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        & py -m venv $VenvPath
    } else {
        Write-Host "[ERROR] Python not found. Please install Python 3.10+." -ForegroundColor Red
        exit 1
    }
}

# Always sync dependencies (removes deleted packages like pgvector/scholarly)
Write-Host "Syncing Python dependencies..." -ForegroundColor Gray
& $PipExe install -r $ReqPath -q

# Launch backend in a dedicated window using the venv python directly (avoids ExecutionPolicy issues)
Start-Process cmd.exe -ArgumentList "/k", "title ResearchLens - Backend (Port 8000) && cd /d `"$BackendPath`" && `"$PythonExe`" main.py"

# 3. Start Frontend
Write-Host ""
Write-Host "[3/3] Launching Frontend (Next.js on port 3000)..." -ForegroundColor Yellow
$FrontendPath    = Join-Path $RootPath "frontend"
$NodeModulesPath = Join-Path $FrontendPath "node_modules"

if (-not (Test-Path $NodeModulesPath)) {
    Write-Host "Installing frontend dependencies..."
    Start-Process cmd.exe -ArgumentList "/c", "cd /d `"$FrontendPath`" && npm install" -Wait -NoNewWindow
}

Start-Process cmd.exe -ArgumentList "/k", "title ResearchLens - Frontend (Port 3000) && cd /d `"$FrontendPath`" && npm run dev"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " ResearchLens is starting up!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " - Frontend:      http://localhost:3000" -ForegroundColor White
Write-Host " - Backend API:   http://localhost:8000/docs" -ForegroundColor White
Write-Host " - Health check:  http://localhost:8000/health" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "(Wait ~5 seconds for both servers to fully initialize.)" -ForegroundColor Gray
