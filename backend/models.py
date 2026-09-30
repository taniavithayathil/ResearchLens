from sqlalchemy import Column, String, Integer, Text, ForeignKey, DateTime, Float, Boolean, Table
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from database import Base

# Junction tables
paper_authors = Table(
    'paper_authors', Base.metadata,
    Column('paper_id', String, ForeignKey('research_papers.id', ondelete='CASCADE'), primary_key=True),
    Column('author_id', String, ForeignKey('authors.id', ondelete='CASCADE'), primary_key=True)
)

paper_topics = Table(
    'paper_topics', Base.metadata,
    Column('paper_id', String, ForeignKey('research_papers.id', ondelete='CASCADE'), primary_key=True),
    Column('topic_id', String, ForeignKey('topics.id', ondelete='CASCADE'), primary_key=True)
)

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    query = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")
    stage = Column(String, default="queued")
    error_message = Column(Text, nullable=True)
    failed_stage = Column(String, nullable=True)
    papers = relationship("Paper", back_populates="analysis", cascade="all, delete-orphan")

class Paper(Base):
    __tablename__ = "research_papers"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id = Column(String, ForeignKey("analyses.id", ondelete="CASCADE"))
    external_id = Column(String, index=True)
    title = Column(String, nullable=False)
    year = Column(Integer)
    abstract = Column(Text)
    venue = Column(String)
    citation_count = Column(Integer, default=0)
    open_access_status = Column(String)
    
    analysis = relationship("Analysis", back_populates="papers")
    authors = relationship("Author", secondary="paper_authors", back_populates="papers")
    topics = relationship("Topic", secondary="paper_topics", back_populates="papers")
    embeddings = relationship("Embedding", back_populates="paper", cascade="all, delete-orphan")

class Author(Base):
    __tablename__ = "authors"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    papers = relationship("Paper", secondary="paper_authors", back_populates="authors")

class Topic(Base):
    __tablename__ = "topics"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True)
    papers = relationship("Paper", secondary="paper_topics", back_populates="topics")

class Embedding(Base):
    __tablename__ = "embeddings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("research_papers.id"))
    chunk_text = Column(Text)
    vector = Column(Text) # Temporarily stored as Text since pgvector is removed
    type = Column(String) # 'abstract', 'limitation', 'future_work'
    
    paper = relationship("Paper", back_populates="embeddings")
