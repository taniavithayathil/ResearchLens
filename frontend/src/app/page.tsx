"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const MAX_QUERY_LENGTH = 500;
const RECENT_TOPICS_KEY = "rl_recent_topics";
const MAX_RECENT = 8;

function loadRecentTopics(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_TOPICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentTopics(topics: string[]): void {
  try {
    localStorage.setItem(RECENT_TOPICS_KEY, JSON.stringify(topics));
  } catch {
    // storage may be unavailable — fail silently
  }
}

function addRecentTopic(topic: string, existing: string[]): string[] {
  const trimmed = topic.trim();
  const filtered = existing.filter(
    (t) => t.toLowerCase() !== trimmed.toLowerCase()
  );
  return [trimmed, ...filtered].slice(0, MAX_RECENT);
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentTopics, setRecentTopics] = useState<string[]>([]);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate recent topics client-side only to avoid SSR mismatch
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecentTopics(loadRecentTopics());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const suggestions = [
    "Zero-Knowledge Proofs in Web3",
    "Explainable AI in Healthcare",
    "Federated Learning for IoT",
    "Quantum Cryptography Protocols",
    "LLM Hallucination Mitigation",
  ];
  const matchingSuggestions = suggestions.filter((suggestion) =>
    suggestion.toLowerCase().includes(query.trim().toLowerCase())
  );
  const displayedSuggestions = (matchingSuggestions.length > 0
    ? matchingSuggestions
    : suggestions
  ).slice(0, 5);

  const handleSearch = async (e?: React.FormEvent, directQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = (directQuery ?? query).trim();

    if (!searchQuery) return;

    if (searchQuery.length > MAX_QUERY_LENGTH) {
      setError(
        `Query is too long (max ${MAX_QUERY_LENGTH} characters). Please shorten it.`
      );
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    // 60-second timeout
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/research/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Try to extract a meaningful server-side message
        let errMessage = `Server error (${res.status})`;
        try {
          const rawText = await res.text();
          const errData = JSON.parse(rawText);
          if (typeof errData?.detail === "string") {
            errMessage = errData.detail;
          } else if (rawText) {
            errMessage = rawText.slice(0, 300);
          }
        } catch {
          // body wasn't JSON — keep generic message
        }
        setError(errMessage);
        return;
      }

      const data = await res.json();
      if (!data?.id) {
        setError("Unexpected response from the server. Please try again.");
        return;
      }

      // Persist to recent topics
      setRecentTopics((prev) => {
        const updated = addRecentTopic(searchQuery, prev);
        saveRecentTopics(updated);
        return updated;
      });

      router.push(`/analysis/${data.id}/overview`);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Request timed out. The backend may be unreachable.");
      } else {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setError(message);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
      <div className="w-full max-w-2xl space-y-12">

        <div className="text-center space-y-4">
          <div className="text-[10px] uppercase tracking-[0.35em] text-[#c6f36b]">Research intelligence / 01</div>
          <h1 className="text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
            ResearchLens
          </h1>
          <p className="text-secondary text-lg">
            Map the research landscape. Find what has been overlooked.
          </p>
        </div>

        <form
          onSubmit={(e) => handleSearch(e)}
          className="w-full relative"
          aria-label="Research topic search"
        >
          <div className="relative group">
            <label htmlFor="research-query" className="sr-only">
              Research topic
            </label>
            <input
              id="research-query"
              type="text"
              value={query}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                setError(null);
              }}
              disabled={loading}
              placeholder="What are you researching? (e.g. AI-based intrusion detection systems)"
              className="w-full bg-[#161616] border border-[#2a2a2a] group-hover:border-[#404040] rounded-xl pl-6 pr-32 py-5 text-[#ededed] text-lg focus:outline-none focus:border-white/30 focus:ring-4 focus:ring-white/5 transition-all shadow-inner disabled:opacity-50"
              maxLength={MAX_QUERY_LENGTH}
              aria-describedby={error ? "search-error" : undefined}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-3 bg-[#c6f36b] text-[#10140a] hover:bg-[#d7ff8a] rounded-lg font-semibold disabled:opacity-50 transition-all shadow-lg shadow-[#c6f36b]/10"
              aria-label={loading ? "Analyzing, please wait" : "Analyze topic"}
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>

          {error && (
            <p
              id="search-error"
              role="alert"
              className="mt-3 text-sm text-red-400 text-center"
            >
              {error}
            </p>
          )}

          {/* Suggestions dropdown */}
          <div
            className={`absolute top-full left-0 w-full mt-3 rounded-xl overflow-hidden z-50 transition-all duration-300 transform origin-top ${
              showSuggestions && !loading
                ? "opacity-100 scale-y-100 shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-white/10"
                : "opacity-0 scale-y-95 pointer-events-none"
            }`}
          >
            <div className="bg-[#1a1a1a]/90 backdrop-blur-xl max-h-[300px] overflow-y-auto">
              {displayedSuggestions.map((suggestion) => (
                  <div
                    key={suggestion}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setQuery(suggestion);
                      setShowSuggestions(false);
                      handleSearch(undefined, suggestion);
                    }}
                    className="flex items-center gap-3 px-6 py-4 hover:bg-white/10 cursor-pointer text-[#a3a3a3] hover:text-white transition-colors border-b border-white/5 last:border-0"
                  >
                    <svg
                      className="w-4 h-4 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span className="font-medium">{suggestion}</span>
                  </div>
                ))}
              {query && matchingSuggestions.length === 0 && (
                <div className="px-6 py-3 text-center text-[#737373] italic border-t border-white/5">
                  Press enter to research &ldquo;{query}&rdquo; across all databases…
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Recent Topics */}
        {recentTopics.length > 0 && (
          <div className="pt-8 border-t border-border flex gap-8 text-sm text-secondary justify-center">
            <div>
              <span className="font-medium text-primary mb-2 block">
                Recent Topics
              </span>
              <ul className="space-y-1">
                {recentTopics.map((topic) => (
                  <li
                    key={topic}
                    onClick={() => {
                      setQuery(topic);
                      handleSearch(undefined, topic);
                    }}
                    className="hover:text-primary cursor-pointer transition-colors"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
