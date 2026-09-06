from abc import ABC, abstractmethod
from typing import List
from schemas import PaperSchema

class ScholarProvider(ABC):
    @abstractmethod
    def search_papers(self, query: str, limit: int = 100) -> List[PaperSchema]:
        """
        Search for papers matching the query.
        Returns a list of PaperSchema objects normalized from the provider's format.
        """
        pass
