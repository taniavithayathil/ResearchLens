"use client";

import { useEffect, useState, use } from "react";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  citation_count: number;
  open_access_status: string | null;
  external_id: string;
}

export default function PapersPage({ params }: { params: Promise<{ id: string }> }) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minCitations, setMinCitations] = useState(0);
  const [recencyYears, setRecencyYears] = useState("any");
  const { id } = use(params);

  useEffect(() => {
    fetch(`/api/research/${id}/papers`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load papers");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setPapers(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading papers:", err);
        setLoading(false);
      });
  }, [id]);

  const normalizedSearch = search.trim().toLowerCase();
  const currentYear = new Date().getFullYear();
  const cutoffYear = recencyYears === "any"
    ? null
    : currentYear - Number(recencyYears) + 1;
  const filteredPapers = papers.filter((paper) => {
    const searchable = `${paper.title} ${paper.authors.join(" ")} ${paper.venue || ""}`.toLowerCase();
    const isRecentEnough = cutoffYear === null || (paper.year !== null && paper.year >= cutoffYear);
    return searchable.includes(normalizedSearch) && paper.citation_count >= minCitations && isRecentEnough;
  });

  if (loading) {
    return <div className="text-secondary animate-pulse">Loading analyzed papers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Analyzed Papers</h1>
        <span className="text-sm font-mono text-secondary">{filteredPapers.length} of {papers.length} papers</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Filter papers</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by title, author, or venue" className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary outline-none focus:border-primary" />
        </label>
        <label>
          <span className="sr-only">Minimum citations</span>
          <input type="number" min="0" value={minCitations} onChange={(event) => setMinCitations(Number(event.target.value) || 0)} placeholder="Min citations" className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary outline-none focus:border-primary sm:w-36" />
        </label>
        <label>
          <span className="sr-only">Filter by recency</span>
          <select value={recencyYears} onChange={(event) => setRecencyYears(event.target.value)} className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary outline-none focus:border-primary sm:w-44" aria-label="Filter papers by recency">
            <option value="any">Any publication date</option>
            <option value="1">Last 1 year</option>
            <option value="3">Last 3 years</option>
            <option value="5">Last 5 years</option>
            <option value="10">Last 10 years</option>
          </select>
        </label>
      </div>
      
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-panel text-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium w-1/2">Title & Authors</th>
              <th className="px-4 py-3 font-medium">Venue</th>
              <th className="px-4 py-3 font-medium text-right">Citations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredPapers.map((paper) => (
              <tr id={paper.id} key={paper.id} className="hover:bg-panel transition-colors scroll-mt-6">
                <td className="px-4 py-3 text-secondary">{paper.year || "-"}</td>
                <td className="px-4 py-3 font-medium text-primary">
                  <a href={paper.external_id} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-white">
                    {paper.title}
                  </a>
                  {paper.open_access_status === "oa" && (
                     <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-[#303030] bg-[#1a1a1a] rounded text-secondary">OA</span>
                  )}
                  {paper.authors && paper.authors.length > 0 && (
                    <div className="text-xs text-secondary font-normal mt-1 truncate max-w-lg">
                      {paper.authors.slice(0, 4).join(", ")}{paper.authors.length > 4 ? " et al." : ""}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-secondary truncate max-w-[200px]" title={paper.venue ?? undefined}>
                  {paper.venue || "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-secondary">
                  {paper.citation_count}
                </td>
              </tr>
            ))}
            {filteredPapers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-secondary">
                  {papers.length === 0 ? "No papers retrieved yet." : "No papers match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
