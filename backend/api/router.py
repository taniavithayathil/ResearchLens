from __future__ import annotations

import concurrent.futures
import difflib
import logging
import math
import re
import uuid
from datetime import datetime
from typing import List

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models import Analysis, Author, Paper
from providers.arxiv import ArxivProvider
from providers.googlescholar import GoogleScholarProvider
from providers.openalex import OpenAlexProvider
from providers.semanticscholar import SemanticScholarProvider
from schemas import AnalysisCreate, AnalysisResponse, PaperSchema
import analytics
import extraction

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Maximum allowed query length (prevents abuse / DB column overflow)
# ---------------------------------------------------------------------------
MAX_QUERY_LENGTH = 500

COMMON_QUERY_CORRECTIONS = {
    "reccomendation": "recommendation",
    "recomendation": "recommendation",
    "recommedation": "recommendation",
    "recomendations": "recommendations",
    "reccomendations": "recommendations",
    "machne": "machine",
    "lernning": "learning",
    "learnng": "learning",
    "federeted": "federated",
    "federatd": "federated",
    "vulnerabilty": "vulnerability",
    "vulnerablity": "vulnerability",
    "explainble": "explainable",
    "cryptograpy": "cryptography",
    "knoledge": "knowledge",
}


def normalize_query_for_retrieval(query: str) -> str:
    """Correct high-confidence domain typos without changing displayed input."""
    known_words = list(COMMON_QUERY_CORRECTIONS)

    def correct_word(word: str) -> str:
        lower_word = word.lower()
        if lower_word in COMMON_QUERY_CORRECTIONS:
            corrected = COMMON_QUERY_CORRECTIONS[lower_word]
        else:
            matches = difflib.get_close_matches(lower_word, known_words, n=1, cutoff=0.9)
            corrected = COMMON_QUERY_CORRECTIONS[matches[0]] if matches else word
        return corrected.capitalize() if word[:1].isupper() else corrected

    return " ".join(
        correct_word(word)
        for word in query.split()
    )


# ---------------------------------------------------------------------------
# Background task — runs after the HTTP response has already been sent
# ---------------------------------------------------------------------------
def run_analysis_task(analysis_id: str, query: str) -> None:
    db = SessionLocal()
    analysis = None
    current_stage = "queued"

    def set_stage(stage: str) -> None:
        nonlocal current_stage
        current_stage = stage
        if analysis is not None:
            analysis.stage = stage
            analysis.status = "running"
            db.commit()

    try:
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if not analysis:
            return

        set_stage("retrieving")
        retrieval_query = normalize_query_for_retrieval(query)
        if retrieval_query != query:
            logger.info("Corrected retrieval query from %r to %r", query, retrieval_query)

        providers = [
            OpenAlexProvider(),
            ArxivProvider(),
            SemanticScholarProvider(),
            GoogleScholarProvider(),
        ]

        # Broad topics need a larger evidence base; deduplication below keeps
        # overlapping provider results from inflating the final corpus.
        limit_per_provider = 75

        def fetch_from_provider(provider):
            try:
                return provider.search_papers(retrieval_query, limit=limit_per_provider)
            except Exception as exc:
                logger.exception("Provider %s failed", provider.__class__.__name__)
                return []

        all_papers_data: list[PaperSchema] = []
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=len(providers))
        futures = {executor.submit(fetch_from_provider, p): p for p in providers}
        completed, timed_out = concurrent.futures.wait(futures, timeout=45)
        for future in completed:
            try:
                all_papers_data.extend(future.result())
            except Exception:
                logger.exception("Provider future failed")
        for future in timed_out:
            provider = futures[future]
            future.cancel()
            logger.warning("Provider %s exceeded the 45-second retrieval limit", provider.__class__.__name__)
        executor.shutdown(wait=False, cancel_futures=True)

        # Deduplicate by normalised title
        seen_titles: set[str] = set()
        query_terms = {
            term
            for term in re.findall(r"[a-z0-9]+", retrieval_query.lower())
            if term not in {"a", "an", "and", "for", "in", "of", "on", "the", "to", "with"}
        }
        minimum_matches = max(1, math.ceil(len(query_terms) / 2))
        for p_data in all_papers_data:
            title_key = (p_data.title or "").lower().strip()
            if not title_key or title_key in seen_titles:
                continue
            searchable_text = f"{p_data.title or ''} {p_data.abstract or ''}".lower()
            if query_terms and sum(term in searchable_text for term in query_terms) < minimum_matches:
                continue
            seen_titles.add(title_key)

            existing = (
                db.query(Paper)
                .filter(
                    Paper.external_id == p_data.external_id,
                    Paper.analysis_id == analysis_id,
                )
                .first()
            )
            if existing:
                continue

            paper = Paper(
                id=p_data.id,
                analysis_id=analysis_id,
                external_id=p_data.external_id,
                title=p_data.title,
                year=p_data.year,
                abstract=p_data.abstract,
                venue=p_data.venue,
                citation_count=p_data.citation_count,
                open_access_status=p_data.open_access_status,
            )

            for author_name in (p_data.authors or []):
                clean_name = str(author_name).strip()
                if not clean_name:
                    continue
                author = db.query(Author).filter(Author.name == clean_name).first()
                if not author:
                    author = Author(name=clean_name)
                    db.add(author)
                paper.authors.append(author)

            db.add(paper)

        if not seen_titles:
            analysis.status = "no_results"
            analysis.stage = "retrieving"
            analysis.error_message = "No papers found. Try broader wording."
            analysis.failed_stage = None
            db.commit()
            return

        set_stage("analyzing")
        papers = db.query(Paper).filter(Paper.analysis_id == analysis_id).all()
        analytics.extract_topics(papers)

        set_stage("extracting")
        extraction.analyze_corpus_gaps(papers)

        analysis.status = "completed"
        analysis.stage = "completed"
        analysis.error_message = None
        analysis.failed_stage = None
        db.commit()
        logger.info("Analysis %s completed with %s unique papers", analysis_id, len(seen_titles))

    except Exception as exc:
        logger.exception("Analysis %s failed", analysis_id)
        db.rollback()
        try:
            analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
            if analysis:
                analysis.status = "failed"
                analysis.stage = "failed"
                analysis.failed_stage = current_stage
                analysis.error_message = str(exc)[:500]
                db.commit()
        except Exception:
            logger.exception("Could not persist failure for analysis %s", analysis_id)
            db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=AnalysisResponse, status_code=202)
def analyze(
    payload: AnalysisCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Kick off a new analysis job.  Returns immediately with status='pending'
    and queues the heavy lifting in a background task.
    """
    query = (payload.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query must be a non-empty string.")
    if len(query) > MAX_QUERY_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Query is too long (max {MAX_QUERY_LENGTH} characters).",
        )

    analysis_id = str(uuid.uuid4())
    analysis = Analysis(
        id=analysis_id,
        query=query,
        status="pending",
        stage="queued",
        created_at=datetime.utcnow(),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    background_tasks.add_task(run_analysis_task, analysis.id, analysis.query)
    return analysis


@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis_status(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return analysis


@router.post("/{analysis_id}/retry", response_model=AnalysisResponse, status_code=202)
def retry_analysis(
    analysis_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if analysis.status in {"pending", "running"}:
        raise HTTPException(status_code=409, detail="Analysis is already running.")

    analysis.status = "pending"
    analysis.stage = "queued"
    analysis.error_message = None
    analysis.failed_stage = None
    db.commit()
    db.refresh(analysis)
    background_tasks.add_task(run_analysis_task, analysis.id, analysis.query)
    return analysis


@router.get("/{analysis_id}/papers", response_model=List[PaperSchema])
def get_analysis_papers(analysis_id: str, db: Session = Depends(get_db)):
    papers = db.query(Paper).filter(Paper.analysis_id == analysis_id).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "authors": [a.name for a in p.authors],
            "year": p.year,
            "venue": p.venue,
            "abstract": p.abstract,
            "citation_count": p.citation_count,
            "open_access_status": p.open_access_status,
            "external_id": p.external_id,
        }
        for p in papers
    ]


@router.get("/{analysis_id}/gaps")
def get_analysis_gaps(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if analysis.status not in {"completed", "no_results"}:
        raise HTTPException(status_code=400, detail="Analysis is not yet complete.")

    papers = db.query(Paper).filter(Paper.analysis_id == analysis_id).all()
    return extraction.analyze_corpus_gaps(papers)


@router.get("/{analysis_id}/topics")
def get_analysis_topics(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if analysis.status not in {"completed", "no_results"}:
        raise HTTPException(status_code=400, detail="Analysis is not yet complete.")

    papers = db.query(Paper).filter(Paper.analysis_id == analysis_id).all()
    return analytics.extract_topics(papers)


@router.get("/debug/search")
def debug_search(q: str):
    """Quick probe of the OpenAlex API — useful for debugging network access."""
    try:
        response = requests.get(
            "https://api.openalex.org/works",
            params={"search": q, "per-page": 5, "sort": "relevance_score:desc"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return {"results": len(data.get("results", [])), "meta": data.get("meta")}
    except Exception as exc:
        return {"error": str(exc)}
