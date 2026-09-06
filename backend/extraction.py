import re
from typing import List, Dict, Any

class MockGapExtractor:
    """
    Simulates an LLM extraction pipeline using NLP heuristics.
    Since we are bypassing external API keys for Phase 4, this module
    reads abstracts and looks for sentences implying limitations or future work.
    """
    
    def __init__(self):
        # Heuristic keywords for finding gaps
        self.limit_keywords = ["limitation", "however", "fails to", "struggles with", "limited to", "shortcoming", "drawback"]
        self.future_keywords = ["future work", "further research", "next steps", "remains open", "future studies", "we plan to"]
        
        # Heuristic keywords for methods and datasets
        self.method_keywords = ["proposed method", "we propose", "algorithm", "architecture", "framework", "model", "technique", "approach"]
        self.dataset_keywords = ["dataset", "corpus", "data set", "evaluated on", "tested on", "benchmark"]
        
    def extract_gaps(self, abstract: str) -> Dict[str, List[str]]:
        if not abstract:
            return {"limitations": [], "future_work": [], "methods": [], "datasets": []}
            
        sentences = re.split(r'(?<=[.!?]) +', abstract)
        
        limitations = []
        future_work = []
        methods = []
        datasets = []
        
        for sentence in sentences:
            s_lower = sentence.lower()
            
            # Check for future work first
            if any(kw in s_lower for kw in self.future_keywords):
                future_work.append(sentence.strip())
                continue
                
            # Check for limitations
            if any(kw in s_lower for kw in self.limit_keywords):
                limitations.append(sentence.strip())
                continue
                
            # Check for methods
            if any(kw in s_lower for kw in self.method_keywords):
                methods.append(sentence.strip())
                continue
                
            # Check for datasets
            if any(kw in s_lower for kw in self.dataset_keywords):
                datasets.append(sentence.strip())
                
        return {
            "limitations": limitations,
            "future_work": future_work,
            "methods": methods,
            "datasets": datasets
        }

def analyze_corpus_gaps(papers: List[Any]) -> List[Dict[str, Any]]:
    """
    Runs the mock extraction over all papers and aggregates the most common gaps, methods, and datasets.
    """
    extractor = MockGapExtractor()
    all_limitations = []
    all_future = []
    all_methods = []
    all_datasets = []
    
    for paper in papers:
        extracted = extractor.extract_gaps(paper.abstract or "")
        
        for lim in extracted["limitations"]:
            all_limitations.append({"text": lim, "paper_id": paper.id, "paper_title": paper.title, "type": "limitation"})
            
        for fw in extracted["future_work"]:
            all_future.append({"text": fw, "paper_id": paper.id, "paper_title": paper.title, "type": "future_work"})
            
        for m in extracted["methods"]:
            all_methods.append({"text": m, "paper_id": paper.id, "paper_title": paper.title, "type": "method"})
            
        for ds in extracted["datasets"]:
            all_datasets.append({"text": ds, "paper_id": paper.id, "paper_title": paper.title, "type": "dataset"})
            
    all_limitations.sort(key=lambda x: len(x["text"]), reverse=True)
    all_future.sort(key=lambda x: len(x["text"]), reverse=True)
    all_methods.sort(key=lambda x: len(x["text"]), reverse=True)
    all_datasets.sort(key=lambda x: len(x["text"]), reverse=True)
    
    return {
        "limitations": all_limitations[:15],
        "future_work": all_future[:15],
        "methods": all_methods[:15],
        "datasets": all_datasets[:15]
    }
