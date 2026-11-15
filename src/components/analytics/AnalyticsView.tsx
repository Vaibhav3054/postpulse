"use client";

import { BarChart3, CheckCircle2, Clock, AlertTriangle, Layers, Activity } from "lucide-react";
import { PostItem } from "../posts/PostsDashboard";

interface ActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface AnalyticsViewProps {
  posts: PostItem[];
  logs: ActivityLogItem[];
  workspaceName: string;
}

export function AnalyticsView({ posts, logs, workspaceName }: AnalyticsViewProps) {
  const publishedCount = posts.filter((p) => p.status === "PUBLISHED").length;
  const scheduledCount = posts.filter((p) => p.status === "SCHEDULED").length;
  const failedCount = posts.filter((p) => p.status === "FAILED" || p.status === "PARTIALLY_PUBLISHED").length;
  const draftsCount = posts.filter((p) => p.status === "DRAFT").length;

  const totalPublishedOrFailed = publishedCount + failedCount;
  const successRate = totalPublishedOrFailed > 0 ? Math.round((publishedCount / totalPublishedOrFailed) * 100) : 100;

  // Platform breakdown counts
  const platformCounts: Record<string, number> = {
    INSTAGRAM: 0,
    FACEBOOK: 0,
    YOUTUBE: 0,
    LINKEDIN: 0,
  };

  posts.forEach((p) => {
    p.platformTargets.forEach((t) => {
      if (platformCounts[t.platform] !== undefined) {
        platformCounts[t.platform]++;
      }
    });
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          Publishing Analytics & Performance — {workspaceName}
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          High-level overview of scheduled pipeline, delivery success rates, and activity audit logs.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Published</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {publishedCount}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Live across networks</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Scheduled</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {scheduledCount}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Queued in background</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Delivery Rate</span>
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {successRate}%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Idempotent execution</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Drafts</span>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {draftsCount}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">In progress</div>
        </div>
      </div>

      {/* Platform Distribution & Activity Logs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Network Breakdown */}
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
            Network Distribution
          </h3>

          <div className="space-y-3 text-xs">
            {Object.entries(platformCounts).map(([platform, count]) => {
              const totalTargets = Object.values(platformCounts).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((count / totalTargets) * 100);

              return (
                <div key={platform} className="space-y-1">
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">{platform}</span>
                    <span className="font-mono text-zinc-500">{count} posts ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        platform === "INSTAGRAM"
                          ? "bg-rose-500"
                          : platform === "FACEBOOK"
                          ? "bg-blue-600"
                          : platform === "YOUTUBE"
                          ? "bg-red-600"
                          : "bg-[#0A66C2]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Audit Log */}
        <div className="md:col-span-2 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            <span>Workspace Activity Audit Trail</span>
          </h3>

          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-xs text-zinc-400 text-center py-6">No activity recorded yet.</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="font-semibold text-zinc-900 dark:text-white font-mono text-[11px]">
                      {log.action}
                    </span>
                    <span className="text-zinc-400 text-[11px]">({log.entityType})</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
