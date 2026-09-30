"use client";

import { useEffect, useState, use } from "react";

interface Topic {
  topic_id: number;
  name: string;
  keywords: string[];
  paper_ids: string[];
  size?: number;
}

export default function TopicsPage({ params }: { params: Promise<{ id: string }> }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { id } = use(params);

  useEffect(() => {
    fetch(`/api/research/${id}/topics`)
      .then((res) => {
        if (!res.ok) throw new Error("Not ready");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setTopics(data);
        }
        setLoading(false);
      })
      .catch(() => {
        // If analysis is still running, topics might 400
        setLoading(false);
      });
  }, [id]);

  const filteredTopics = topics.filter((topic) =>
    `${topic.name} ${topic.keywords.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (loading) {
    return <div className="text-secondary animate-pulse">Clustering papers into sub-topics...</div>;
  }

  if (topics.length === 0) {
    return <div className="text-secondary">No topics could be extracted yet.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Research Landscape Clusters</h1>
      <p className="text-secondary text-sm">
        Papers have been clustered based on TF-IDF semantic similarity of their abstracts.
      </p>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter topics or keywords" className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary outline-none focus:border-primary" aria-label="Filter topics or keywords" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {filteredTopics.map((topic) => (
          <div key={topic.topic_id} className="bg-panel border border-border rounded-lg p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium text-primary">{topic.name}</h3>
              <span className="text-xs font-mono text-secondary px-2 py-1 bg-background rounded">
                {topic.size ?? topic.paper_ids?.length ?? 0} papers
              </span>
            </div>
            
            <div>
              <span className="text-xs text-secondary uppercase tracking-wider font-semibold mb-2 block">
                Top Keywords
              </span>
              <div className="flex flex-wrap gap-2">
                {(topic.keywords || []).map((kw) => (
                  <span key={kw} className="text-xs px-2 py-1 bg-accent bg-opacity-20 border border-accent rounded text-primary">
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {topic.paper_ids?.length > 0 && (
              <div className="border-t border-border/50 pt-3">
                <span className="text-xs text-secondary uppercase tracking-wider font-semibold mb-2 block">
                  Papers in cluster
                </span>
                <div className="flex flex-wrap gap-2">
                  {topic.paper_ids.slice(0, 3).map((paperId, index) => (
                    <a key={paperId} href={`../papers#${paperId}`} className="text-xs text-[#c6f36b] hover:underline">
                      Paper {index + 1}
                    </a>
                  ))}
                  {topic.paper_ids.length > 3 && <span className="text-xs text-secondary">+{topic.paper_ids.length - 3} more</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {filteredTopics.length === 0 && <p className="text-secondary">No topics match this filter.</p>}
    </div>
  );
}
