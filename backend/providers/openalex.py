import requests
import uuid
from typing import List
from .base import ScholarProvider
from schemas import PaperSchema

class OpenAlexProvider(ScholarProvider):
    BASE_URL = "https://api.openalex.org/works"

    def search_papers(self, query: str, limit: int = 100) -> List[PaperSchema]:
        params = {
            "search": query,
            "per-page": limit,
            # Fetch highly relevant and cited works
            "sort": "relevance_score:desc"
        }
        
        response = requests.get(self.BASE_URL, params=params)
        response.raise_for_status()
        
        data = response.json()
        results = data.get("results", [])
        
        papers = []
        for item in results:
            authors = [a.get("author", {}).get("display_name") for a in item.get("authorships", [])]
            abstract = self._reconstruct_abstract(item.get("abstract_inverted_index", {}))
            
            # Use OA URL if available, else primary location
            oa = item.get("open_access", {})
            oa_status = oa.get("oa_status", "closed")
            
            paper = PaperSchema(
                id=str(uuid.uuid4()),
                external_id=item.get("id"),
                title=item.get("title") or "Untitled",
                authors=authors,
                year=item.get("publication_year"),
                venue=item.get("primary_location", {}).get("source", {}).get("display_name") if item.get("primary_location") and item.get("primary_location").get("source") else None,
                abstract=abstract,
                citation_count=item.get("cited_by_count", 0),
                open_access_status=oa_status
            )
            papers.append(paper)
            
        return papers

    def _reconstruct_abstract(self, inverted_index: dict) -> str:
        if not inverted_index:
            return ""
        
        # Inverted index: {"Word": [0, 15], "Another": [1]}
        # Reconstruct string by placing words at indices
        word_index = []
        for word, indices in inverted_index.items():
            for idx in indices:
                word_index.append((idx, word))
                
        word_index.sort(key=lambda x: x[0])
        return " ".join([w[1] for w in word_index])
