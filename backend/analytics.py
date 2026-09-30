from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
import numpy as np
from models import Paper

def extract_topics(papers: List[Paper], n_clusters: int = 5) -> List[Dict[str, Any]]:
    """
    Groups papers into distinct topics based on their abstracts and titles using TF-IDF and K-Means.
    Extracts the top keywords for each cluster.
    """
    if not papers:
        return []
        
    # If we have very few papers, reduce n_clusters
    n_clusters = max(1, min(n_clusters, len(papers)))
    if len(papers) <= 2:
        n_clusters = 1

    # Prepare corpus
    corpus = []
    for p in papers:
        title = p.title or ""
        abstract = p.abstract or ""
        # Give title more weight by duplicating it
        corpus.append(f"{title} {title} {abstract}")

    # Vectorize - use min_df=1 for small corpora
    min_df = 1 if len(papers) < 5 else 2
    vectorizer = TfidfVectorizer(stop_words='english', max_df=0.85, min_df=min_df, max_features=1000)
    try:
        X = vectorizer.fit_transform(corpus)
    except ValueError:
        # Happens if vocab is completely empty (e.g., extremely short/weird abstracts)
        return [{"topic_id": 0, "name": "General Research", "keywords": ["research"], "paper_ids": [p.id for p in papers], "size": len(papers)}]

    if X.shape[1] == 0:
        return [{"topic_id": 0, "name": "General Research", "keywords": ["research"], "paper_ids": [p.id for p in papers], "size": len(papers)}]

    # K-Means clustering
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(X)
    
    # Extract top keywords per cluster
    order_centroids = kmeans.cluster_centers_.argsort()[:, ::-1]
    terms = vectorizer.get_feature_names_out()
    
    clusters = []
    labels = kmeans.labels_
    
    for i in range(n_clusters):
        top_indices = order_centroids[i, :5]
        top_keywords = [terms[ind] for ind in top_indices if ind < len(terms)]
        
        cluster_paper_ids = [papers[j].id for j in range(len(papers)) if labels[j] == i]
        
        # Don't create empty clusters
        if not cluster_paper_ids:
            continue
            
        # Give the cluster a capitalized name based on its top 2 keywords
        topic_name = " & ".join(top_keywords[:2]).title() if top_keywords else f"Topic {i+1}"
        
        clusters.append({
            "topic_id": i,
            "name": topic_name,
            "keywords": top_keywords,
            "paper_ids": cluster_paper_ids,
            "size": len(cluster_paper_ids)
        })
        
    # Sort clusters by size descending
    clusters.sort(key=lambda x: x["size"], reverse=True)
    return clusters
