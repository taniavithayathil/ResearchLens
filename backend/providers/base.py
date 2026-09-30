from abc import ABC, abstractmethod
from typing import List
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from schemas import PaperSchema


def create_http_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        status=3,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    session.headers.update({"User-Agent": "ResearchLens/1.0"})
    return session

class ScholarProvider(ABC):
    @abstractmethod
    def search_papers(self, query: str, limit: int = 100) -> List[PaperSchema]:
        """
        Search for papers matching the query.
        Returns a list of PaperSchema objects normalized from the provider's format.
        """
        pass
