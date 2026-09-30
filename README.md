# ResearchLens — AI-Assisted Research Gap Discovery and Recommendation System

ResearchLens is a production-grade research analytics platform designed to construct a structured representation of academic landscapes and identify potentially underexplored research areas using multiple evidence signals.

## Project Structure
- `backend/`: FastAPI Python application handling data ingestion, NLP, and gap detection.
- `frontend/`: (To be initialized) Next.js application for the research analytics dashboard.
- `docker-compose.yml`: Database (PostgreSQL + pgvector) and Redis cache.

## Initial Setup Instructions

Due to a local environment restriction, I have scaffolded the backend files but cannot execute terminal commands directly to install dependencies. Please run the following commands manually to complete the initialization.

### 1. Database Setup
Ensure Docker Desktop is running, then start the database and cache:
```powershell
docker-compose up -d
```

### 2. Frontend Initialization (Next.js)
Initialize the frontend inside the project root:
```powershell
npx -y create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

### 3. Backend Setup
Create a virtual environment and install the required Python packages:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Running the API
Once dependencies are installed and the database is running:
```powershell
uvicorn main:app --reload --port 8000
```
