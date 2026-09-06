import requests
import uuid
from typing import List
import xml.etree.ElementTree as ET
from .base import ScholarProvider
from schemas import PaperSchema

class ArxivProvider(ScholarProvider):
    BASE_URL = "http://export.arxiv.org/api/query"

    def search_papers(self, query: str, limit: int = 50) -> List[PaperSchema]:
        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": limit,
            "sortBy": "relevance",
            "sortOrder": "descending"
        }
        
        try:
            response = requests.get(self.BASE_URL, params=params, timeout=10)
            response.raise_for_status()
        except requests.RequestException:
            # Graceful fallback on API failure
            return []
            
        return self._parse_atom_xml(response.text)
        
    def _parse_atom_xml(self, xml_text: str) -> List[PaperSchema]:
        papers = []
        try:
            root = ET.fromstring(xml_text)
            # arXiv XML uses the Atom namespace
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            
            for entry in root.findall('atom:entry', ns):
                title = entry.find('atom:title', ns)
                title_text = title.text.strip().replace('\n', ' ') if title is not None else "Untitled"
                
                abstract = entry.find('atom:summary', ns)
                abstract_text = abstract.text.strip().replace('\n', ' ') if abstract is not None else ""
                
                published = entry.find('atom:published', ns)
                year = int(published.text[:4]) if published is not None else None
                
                authors = []
                for author in entry.findall('atom:author', ns):
                    name = author.find('atom:name', ns)
                    if name is not None:
                        authors.append(name.text)
                        
                id_tag = entry.find('atom:id', ns)
                external_id = id_tag.text if id_tag is not None else ""
                
                papers.append(PaperSchema(
                    id=str(uuid.uuid4()),
                    external_id=external_id,
                    title=title_text,
                    authors=authors,
                    year=year,
                    venue="arXiv",
                    abstract=abstract_text,
                    citation_count=0, # arXiv API doesn't provide citation counts directly
                    open_access_status="oa" # arXiv is always open access
                ))
        except ET.ParseError:
            pass
            
        return papers
