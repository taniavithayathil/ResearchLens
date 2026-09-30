"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

interface AnalysisData {
  id: string;
  query: string;
  status: "pending" | "running" | "completed" | "failed" | "no_results";
  stage?: string | null;
  error_message?: string | null;
  failed_stage?: string | null;
  created_at: string;
}

interface Topic {
  topic_id: number;
  name: string;
  keywords: string[];
  paper_ids: string[];
  size: number;
}

interface GapsData {
  limitations: { text: string; paper_id: string; paper_title: string }[];
  future_work: { text: string; paper_id: string; paper_title: string }[];
}

interface Paper {
  id: string;
  title: string;
  year: number | null;
  citation_count: number;
}

export default function OverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [gaps, setGaps] = useState<GapsData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/research/${id}`, { cache: "no-store" });
        if (!res.ok) {
          setFetchError(`Could not load analysis (${res.status})`);
          return;
        }
        const data: AnalysisData = await res.json();
        if (!cancelled) setAnalysis(data);

        if (data.status === "completed" || data.status === "no_results") {
          const [pRes, tRes, gRes] = await Promise.all([
            fetch(`/api/research/${id}/papers`, { cache: "no-store" }),
            fetch(`/api/research/${id}/topics`, { cache: "no-store" }),
            fetch(`/api/research/${id}/gaps`, { cache: "no-store" }),
          ]);
          if (!cancelled) {
            if (pRes.ok) setPapers(await pRes.json());
            if (tRes.ok) setTopics(await tRes.json());
            if (gRes.ok) setGaps(await gRes.json());
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : "Network error."
          );
        }
      }
    };

    poll();
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/research/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: AnalysisData = await res.json();
        if (cancelled) return;
        setAnalysis(data);

        if (data.status === "completed" || data.status === "failed" || data.status === "no_results") {
          clearInterval(interval);
          if (data.status === "completed" || data.status === "no_results") {
            const [pRes, tRes, gRes] = await Promise.all([
              fetch(`/api/research/${id}/papers`, { cache: "no-store" }),
              fetch(`/api/research/${id}/topics`, { cache: "no-store" }),
              fetch(`/api/research/${id}/gaps`, { cache: "no-store" }),
            ]);
            if (!cancelled) {
              if (pRes.ok) setPapers(await pRes.json());
              if (tRes.ok) setTopics(await tRes.json());
              if (gRes.ok) setGaps(await gRes.json());
            }
          }
        }
      } catch {
        // Polling errors are non-fatal
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  if (fetchError) {
    return (
      <div
        role="alert"
        className="bg-red-950/40 border border-red-800/50 rounded-lg p-4 text-sm text-red-300"
      >
        ⚠️ {fetchError}
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-secondary animate-pulse">
        Loading analysis data…
      </div>
    );
  }

  const candidateGaps =
    (gaps?.limitations?.length ?? 0) + (gaps?.future_work?.length ?? 0);
  const stages = [
    { key: "queued", label: "Queued" },
    { key: "retrieving", label: "Retrieving papers" },
    { key: "analyzing", label: "Finding topics" },
    { key: "extracting", label: "Extracting gaps" },
    { key: "completed", label: "Complete" },
  ];
  const currentStageIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.key === analysis.stage)
  );
  const progressPercent = analysis.status === "completed"
    ? 100
    : Math.max(8, (currentStageIndex / (stages.length - 1)) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold mb-2">{analysis.query}</h1>
        <div className="flex gap-4 text-sm text-secondary">
          <span>
            Status:{" "}
            <span className="text-primary capitalize">{analysis.status}</span>
          </span>
          <span>
            Created:{" "}
            {new Date(analysis.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {(analysis.status === "pending" || analysis.status === "running") && (
        <div className="bg-panel border border-border/60 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-secondary">
              {stages[currentStageIndex]?.label || "Preparing analysis"}
            </p>
            <span className="text-xs text-secondary">This can take a minute</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-label="Analysis progress">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-secondary sm:grid-cols-5">
            {stages.map((stage, index) => (
              <span
                key={stage.key}
                className={index <= currentStageIndex ? "text-primary" : ""}
              >
                {stage.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.status === "failed" && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-4 text-sm text-red-300 space-y-3">
          <p role="alert">
            Analysis failed during {analysis.failed_stage || analysis.stage || "the pipeline"}: {analysis.error_message || "The backend returned no additional details."}
          </p>
          <button
            type="button"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              setRetryError(null);
              try {
                const response = await fetch(`/api/research/${id}/retry`, { method: "POST" });
                if (!response.ok) {
                  const body = await response.json().catch(() => null);
                  throw new Error(body?.detail || "Retry could not be started.");
                }
                const retried: AnalysisData = await response.json();
                setAnalysis(retried);
                router.refresh();
              } catch (error) {
                setRetryError(error instanceof Error ? error.message : "Retry could not be started.");
              } finally {
                setRetrying(false);
              }
            }}
            className="rounded-md border border-red-700 px-3 py-2 text-xs text-red-200 hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retrying ? "Retrying…" : "Retry analysis"}
          </button>
          {retryError && <p className="text-xs text-red-300">{retryError}</p>}
        </div>
      )}

      {analysis.status === "no_results" && (
        <div role="status" className="bg-panel border border-border/60 rounded-lg p-4 text-sm text-secondary">
          {analysis.error_message || "No papers found. Try broader wording."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        <div className="bg-panel border border-border rounded-lg p-6 flex flex-col gap-2">
          <span className="text-secondary text-sm font-medium">
            Papers Retrieved
          </span>
          <span className="text-4xl font-mono">{papers.length}</span>
        </div>
        <div className="bg-panel border border-border rounded-lg p-6 flex flex-col gap-2">
          <span className="text-secondary text-sm font-medium">
            Topics Discovered
          </span>
          <span className="text-4xl font-mono">{topics.length}</span>
          <span className="text-xs text-secondary mt-1">NLP Clusters</span>
        </div>
        <div className="bg-panel border border-border rounded-lg p-6 flex flex-col gap-2">
          <span className="text-secondary text-sm font-medium">
            Candidate Gaps
          </span>
          <span className="text-4xl font-mono">{candidateGaps}</span>
          <span className="text-xs text-secondary mt-1">
            Limitations &amp; Future Work
          </span>
        </div>
      </div>
    </div>
  );
}
