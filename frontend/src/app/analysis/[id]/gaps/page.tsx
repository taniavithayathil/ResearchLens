"use client";

import { useEffect, useState, use } from "react";

interface GapItem {
  text: string;
  paper_id: string;
  paper_title: string;
  paper_url?: string | null;
  type: string;
}

interface GapsData {
  limitations: GapItem[];
  future_work: GapItem[];
}

export default function GapsPage({ params }: { params: Promise<{ id: string }> }) {
  const [gaps, setGaps] = useState<GapsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gapType, setGapType] = useState<"all" | "limitations" | "future_work">("all");
  const { id } = use(params);

  useEffect(() => {
    fetch(`/api/research/${id}/gaps`)
      .then((res) => {
        if (!res.ok) throw new Error("Not ready");
        return res.json();
      })
      .then((data) => {
        setGaps(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="text-secondary animate-pulse">Running gap extraction engine...</div>;
  }

  const limitations = gaps?.limitations || [];
  const futureWork = gaps?.future_work || [];
  const filteredLimitations = limitations.filter((gap) =>
    `${gap.text} ${gap.paper_title}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const filteredFutureWork = futureWork.filter((gap) =>
    `${gap.text} ${gap.paper_title}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const visibleLimitations = gapType === "future_work" ? [] : filteredLimitations;
  const visibleFutureWork = gapType === "limitations" ? [] : filteredFutureWork;

  if (limitations.length === 0 && futureWork.length === 0) {
    return <div className="text-secondary">No explicit gaps or limitations could be extracted from this corpus.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Research Gap Discovery</h1>
        <p className="text-secondary text-sm mt-1">
          The engine has parsed the abstracts to identify explicitly stated limitations and future work proposals.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter gaps or source papers" className="flex-1 rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary outline-none focus:border-primary" aria-label="Filter gaps or source papers" />
        <select value={gapType} onChange={(event) => setGapType(event.target.value as typeof gapType)} className="rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary outline-none focus:border-primary" aria-label="Filter gap type">
          <option value="all">All gap types</option>
          <option value="limitations">Limitations</option>
          <option value="future_work">Future work</option>
        </select>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Limitations Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h2 className="text-lg font-medium">Common Limitations</h2>
            <span className="text-xs font-mono text-secondary">{visibleLimitations.length} identified</span>
          </div>
          <div className="space-y-4">
            {visibleLimitations.map((lim, i) => (
              <div key={`lim-${i}`} className="bg-panel border border-border rounded-lg p-4 text-sm">
                <p className="text-primary leading-relaxed mb-3">&quot;{lim.text}&quot;</p>
                <div className="flex items-center text-xs text-secondary">
                  <span className="font-mono text-accent">Source: </span>
                  <a href={lim.paper_url || `../papers#${lim.paper_id}`} target={lim.paper_url ? "_blank" : undefined} rel={lim.paper_url ? "noopener noreferrer" : undefined} className="ml-2 truncate max-w-[250px] italic hover:text-primary hover:underline">{lim.paper_title}</a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Future Work Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h2 className="text-lg font-medium">Proposed Future Work</h2>
            <span className="text-xs font-mono text-secondary">{visibleFutureWork.length} identified</span>
          </div>
          <div className="space-y-4">
            {visibleFutureWork.map((fw, i) => (
              <div key={`fw-${i}`} className="bg-panel border border-border rounded-lg p-4 text-sm">
                <p className="text-primary leading-relaxed mb-3">&quot;{fw.text}&quot;</p>
                <div className="flex items-center text-xs text-secondary">
                  <span className="font-mono text-accent">Source: </span>
                  <a href={fw.paper_url || `../papers#${fw.paper_id}`} target={fw.paper_url ? "_blank" : undefined} rel={fw.paper_url ? "noopener noreferrer" : undefined} className="ml-2 truncate max-w-[250px] italic hover:text-primary hover:underline">{fw.paper_title}</a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {visibleLimitations.length === 0 && visibleFutureWork.length === 0 && (
          <p className="text-secondary">No gaps match these filters.</p>
        )}

      </div>
    </div>
  );
}
