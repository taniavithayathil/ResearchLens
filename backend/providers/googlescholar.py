import uuid
from typing import List
from scholarly import scholarly
from .base import ScholarProvider
from schemas import PaperSchema

class GoogleScholarProvider(ScholarProvider):
    def search_papers(self, query: str, limit: int = 20) -> List[PaperSchema]:
        """
        Uses scholarly to scrape Google Scholar. 
        Limit is kept low to prevent IP bans.
        """
        papers = []
        
        try:
            # scholarly.search_pubs returns a generator
            search_query = scholarly.search_pubs(query)
            
            for _ in range(limit):
                try:
                    pub = next(search_query)
                    bib = pub.get("bib", {})
                    
                    authors = bib.get("author", [])
                    if isinstance(authors, str):
                        # scholarly sometimes returns authors as a single string "A Name and B Name"
                        authors = [a.strip() for a in authors.split(" and ")]
                        
                    papers.append(PaperSchema(
                        id=str(uuid.uuid4()),
                        external_id=pub.get("pub_url") or bib.get("url") or f"gscholar_{uuid.uuid4()}",
                        title=bib.get("title", "Untitled"),
                        authors=authors,
                        year=int(bib.get("pub_year")) if bib.get("pub_year") else None,
                        venue=bib.get("venue"),
                        abstract=bib.get("abstract", ""),
                        citation_count=pub.get("num_citations", 0),
                        open_access_status="closed" # Difficult to determine robustly from GS
                    ))
                except StopIteration:
                    break
        except Exception as e:
            # Handle CAPTCHA or blocking gracefully
            print(f"Google Scholar scraping failed: {e}")
            pass
            
        return papers
