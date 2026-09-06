from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from api import router as api_router

# Create tables
# In production, use Alembic migrations instead of this.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ResearchLens API",
    description="AI-Assisted Research Gap Discovery and Recommendation System",
    version="0.1.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router.router, prefix="/api/research", tags=["research"])

@app.get("/health")
def health_check():
    return {"status": "healthy"}
