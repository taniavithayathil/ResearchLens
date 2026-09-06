from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class PaperSchema(BaseModel):
    id: str
    title: str
    authors: List[str]
    year: Optional[int]
    venue: Optional[str]
    abstract: Optional[str]
    citation_count: int
    open_access_status: Optional[str]
    external_id: str

    model_config = ConfigDict(from_attributes=True)

class AnalysisCreate(BaseModel):
    query: str

class AnalysisResponse(BaseModel):
    id: str
    query: str
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
