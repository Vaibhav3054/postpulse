"use client";

import { Play, PenSquare, RefreshCw } from "lucide-react";
import { useState } from "react";

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
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {dispatchMessage && (
          <span className="text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium animate-fade-in">
            {dispatchMessage}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {/* Worker Dispatch Trigger for testing */}
        <button
          onClick={handleManualDispatch}
          disabled={isDispatching}
          title="Manually trigger background publishing worker to scan and publish due posts"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isDispatching ? "animate-spin" : ""}`} />
          <span>Sync Due Posts</span>
        </button>

        {/* Quick Create CTA if not on composer page */}
        {title !== "Content Composer" && (
          <a
            href={`/app/${workspaceSlug}/composer`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>New Post</span>
          </a>
        )}
      </div>
    </header>
  );
}
