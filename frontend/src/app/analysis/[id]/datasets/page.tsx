"use client";

import { useEffect, useState, use } from "react";

interface GapItem {
  text: string;
  paper_id: string;
  paper_title: string;
  paper_url?: string | null;
  type: string;
}

export default function DatasetsPage({ params }: { params: Promise<{ id: string }> }) {
  const [datasets, setDatasets] = useState<GapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { id } = use(params);

  useEffect(() => {
    fetch(`/api/research/${id}/gaps`)
      .then((res) => {
        if (!res.ok) throw new Error("Not ready");
        return res.json();
      })
      .then((data) => {
        setDatasets(data.datasets || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  const filteredDatasets = datasets.filter((dataset) =>
    `${dataset.text} ${dataset.paper_title}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (loading) {
    return <div className="text-secondary animate-pulse">Extracting datasets...</div>;
  }

  if (datasets.length === 0) {
    return <div className="text-secondary">No explicit datasets or benchmarks could be extracted from this corpus.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dataset Inventory</h1>
        <p className="text-secondary text-sm mt-1">
          The engine has parsed the abstracts to identify which public datasets and benchmarks are heavily utilized.
        </p>
      </div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter datasets or source papers" className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary outline-none focus:border-primary" aria-label="Filter datasets or source papers" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDatasets.map((ds, i) => (
          <div key={`ds-${i}`} className="bg-panel border border-border rounded-lg p-5 text-sm flex flex-col justify-between">
            <p className="text-primary leading-relaxed mb-4">&quot;{ds.text}&quot;</p>
            <div className="flex items-center text-xs text-secondary pt-3 border-t border-border/50">
              <span className="font-mono text-accent">Source: </span>
              <a href={ds.paper_url || `../papers#${ds.paper_id}`} target={ds.paper_url ? "_blank" : undefined} rel={ds.paper_url ? "noopener noreferrer" : undefined} className="ml-2 truncate italic hover:text-primary hover:underline">{ds.paper_title}</a>
            </div>
          </div>
        ))}
      </div>
      {filteredDatasets.length === 0 && <p className="text-secondary">No datasets match this filter.</p>}
    </div>
  );
}
