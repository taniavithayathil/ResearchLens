from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Analysis, Paper, Author
from schemas import AnalysisCreate, AnalysisResponse, PaperSchema
from providers.openalex import OpenAlexProvider
from providers.arxiv import ArxivProvider
from providers.semanticscholar import SemanticScholarProvider
from providers.googlescholar import GoogleScholarProvider
import analytics
import extraction
import concurrent.futures
import requests

router = APIRouter()

def run_analysis_task(analysis_id: str, query: str):
    # This would typically be a Celery task. For now, running sync for MVP testing.
    db = next(get_db())
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        return
        
    try:
        providers = [
            OpenAlexProvider(), 
            ArxivProvider(), 
            SemanticScholarProvider(),
            GoogleScholarProvider()
        ]
        all_papers_data = []
        
        # Limit per provider to avoid overwhelming the local DB during tests
        limit_per_provider = 30 
        
        def fetch_from_provider(provider):
            try:
                return provider.search_papers(query, limit=limit_per_provider)
            except Exception as e:
                print(f"Error fetching from {provider.__class__.__name__}: {e}")
                return []
                
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(providers)) as executor:
            future_to_provider = {executor.submit(fetch_from_provider, p): p for p in providers}
            for future in concurrent.futures.as_completed(future_to_provider):
                papers = future.result()
                all_papers_data.extend(papers)
                
        # Deduplicate by lowercase title
        seen_titles = set()
        
        for p_data in all_papers_data:
            title_lower = p_data.title.lower() if p_data.title else ""
            if title_lower in seen_titles:
                continue
            seen_titles.add(title_lower)
            
            # Check if paper already exists in THIS analysis (deduplication by external_id)
            existing = db.query(Paper).filter(Paper.external_id == p_data.external_id, Paper.analysis_id == analysis_id).first()
            if not existing:
                paper = Paper(
                    id=p_data.id,
                    analysis_id=analysis_id,
                    external_id=p_data.external_id,
                    title=p_data.title,
                    year=p_data.year,
                    abstract=p_data.abstract,
                    venue=p_data.venue,
                    citation_count=p_data.citation_count,
                    open_access_status=p_data.open_access_status
                )
                db.add(paper)
                
        analysis.status = "completed"
        db.commit()
    except Exception as e:
        print(f"Error during analysis: {e}")
        analysis.status = "failed"
        db.commit()

@router.post("/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalysisCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    analysis = Analysis(query=payload.query)
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    
    background_tasks.add_task(run_analysis_task, analysis.id, analysis.query)
    return analysis

@router.get("/research/{analysis_id}/gaps")
def get_analysis_gaps(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="Analysis is not yet complete")
        
    papers = db.query(Paper).filter(Paper.analysis_id == analysis_id).all()
    
    # Run the NLP gap extraction engine
    gaps = extraction.analyze_corpus_gaps(papers)
    return gaps

@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis_status(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis

@router.get("/{analysis_id}/papers", response_model=List[PaperSchema])
def get_analysis_papers(analysis_id: str, db: Session = Depends(get_db)):
    papers = db.query(Paper).filter(Paper.analysis_id == analysis_id).all()
    # Formatting for schema
    results = []
    for p in papers:
        results.append({
            "id": p.id,
            "title": p.title,
            "authors": [a.name for a in p.authors], # Empty for now since we didn't populate
            "year": p.year,
            "venue": p.venue,
            "abstract": p.abstract,
            "citation_count": p.citation_count,
            "open_access_status": p.open_access_status,
            "external_id": p.external_id
        })
    return results

@router.get("/debug")
def debug_search(q: str):
    try:
        response = requests.get("https://api.openalex.org/works", params={"search": q, "per-page": 5, "sort": "relevance_score:desc"})
        response.raise_for_status()
        data = response.json()
        return {"results": len(data.get("results", [])), "meta": data.get("meta")}
    except Exception as e:
        return {"error": str(e)}
