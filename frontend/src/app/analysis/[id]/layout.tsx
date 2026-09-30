"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export default function AnalysisLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const pathname = usePathname();
  const { id } = React.use(params);

  const tabs = [
    { name: "Overview", href: `/analysis/${id}/overview` },
    { name: "Papers", href: `/analysis/${id}/papers` },
    { name: "Topics", href: `/analysis/${id}/topics` },
    { name: "Methods", href: `/analysis/${id}/methods` },
    { name: "Datasets", href: `/analysis/${id}/datasets` },
    { name: "Gaps", href: `/analysis/${id}/gaps` },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-primary">
      {/* TopBar */}
      <header className="h-16 border-b border-border flex items-center px-6 justify-between shrink-0 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <Link href="/" className="font-semibold tracking-tight hover:text-white transition-colors flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[#c6f36b] shadow-[0_0_14px_rgba(198,243,107,0.8)]" />
          ResearchLens
        </Link>
        <div className="flex items-center gap-4 text-sm text-secondary">
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-[#c6f36b] sm:inline">Research map / live</span>
          <span>Analysis: <span className="font-mono text-primary">{id.slice(0, 8)}...</span></span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 border-r border-border shrink-0 p-4 space-y-1 overflow-y-auto bg-[#0a0a0a]/45">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? "bg-[#c6f36b] text-[#10140a] font-medium shadow-[0_8px_24px_rgba(198,243,107,0.12)]"
                    : "text-secondary hover:bg-panel hover:text-primary"
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto bg-transparent p-5 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
