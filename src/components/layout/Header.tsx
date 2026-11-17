"use client";

import { Play, PenSquare, RefreshCw, Menu } from "lucide-react";
import { useState } from "react";
import { useMobileNav } from "./AppShell";

interface HeaderProps {
  title: string;
  workspaceSlug: string;
  connectedCount?: number;
  scheduledCount?: number;
}

export function Header({
  title,
  workspaceSlug,
  connectedCount = 0,
  scheduledCount = 0,
}: HeaderProps) {
  const { openMobileSidebar } = useMobileNav();
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);

  const handleManualDispatch = async () => {
    setIsDispatching(true);
    setDispatchMessage(null);
    try {
      const res = await fetch("/api/publishing/dispatch", { method: "POST" });
      const data = await res.json();
      setDispatchMessage(`Processed ${data.processedCount || 0} due posts.`);
      setTimeout(() => setDispatchMessage(null), 4000);
    } catch {
      setDispatchMessage("Failed to run dispatcher.");
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Menu */}
        <button
          type="button"
          onClick={openMobileSidebar}
          className="md:hidden p-1.5 -ml-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white tracking-tight truncate">
          {title}
        </h1>
        {dispatchMessage && (
          <span className="hidden sm:inline-block text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium animate-fade-in shrink-0">
            {dispatchMessage}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Worker Dispatch Trigger for testing */}
        <button
          onClick={handleManualDispatch}
          disabled={isDispatching}
          title="Manually trigger background publishing worker to scan and publish due posts"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isDispatching ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Sync Due Posts</span>
          <span className="sm:hidden">Sync</span>
        </button>

        {/* Quick Create CTA if not on composer page */}
        {title !== "Content Composer" && (
          <a
            href={`/app/${workspaceSlug}/composer`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Post</span>
          </a>
        )}
      </div>
    </header>
  );
}
