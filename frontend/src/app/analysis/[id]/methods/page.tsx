"use client";

import { useEffect, useState, use } from "react";

interface GapItem {
  text: string;
  paper_id: string;
  paper_title: string;
  paper_url?: string | null;
  type: string;
}

export default function MethodsPage({ params }: { params: Promise<{ id: string }> }) {
  const [methods, setMethods] = useState<GapItem[]>([]);
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
        setMethods(data.methods || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  const filteredMethods = methods.filter((method) =>
    `${method.text} ${method.paper_title}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (loading) {
    return <div className="text-secondary animate-pulse">Extracting methodologies...</div>;
  }

  if (methods.length === 0) {
    return <div className="text-secondary">No explicit methods or architectures could be extracted from this corpus.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Methodology Extraction</h1>
        <p className="text-secondary text-sm mt-1">
          The engine has parsed the abstracts to identify the primary algorithms, architectures, and approaches used.
        </p>
      </div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter methods or source papers" className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary outline-none focus:border-primary" aria-label="Filter methods or source papers" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMethods.map((method, i) => (
          <div key={`m-${i}`} className="bg-panel border border-border rounded-lg p-5 text-sm flex flex-col justify-between">
            <p className="text-primary leading-relaxed mb-4">&quot;{method.text}&quot;</p>
            <div className="flex items-center text-xs text-secondary pt-3 border-t border-border/50">
              <span className="font-mono text-accent">Source: </span>
              <a href={method.paper_url || `../papers#${method.paper_id}`} target={method.paper_url ? "_blank" : undefined} rel={method.paper_url ? "noopener noreferrer" : undefined} className="ml-2 truncate italic hover:text-primary hover:underline">{method.paper_title}</a>
            </div>
          </div>
        ))}
      </div>
      {filteredMethods.length === 0 && <p className="text-secondary">No methods match this filter.</p>}
    </div>
  );
}
