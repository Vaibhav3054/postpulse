"use client";

import { useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  Download,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
} from "lucide-react";
import { PostItem } from "../posts/PostsDashboard";
import { PerformancePieChart, PerformanceBarChart, PLATFORM_COLORS } from "./Charts";
import { generateAndPrintPdfReport } from "@/lib/pdf-report";

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
  const [isExporting, setIsExporting] = useState(false);

  const publishedPosts = posts.filter((p) => p.status === "PUBLISHED");
  const publishedCount = publishedPosts.length;
  const scheduledCount = posts.filter((p) => p.status === "SCHEDULED").length;
  const failedCount = posts.filter((p) => p.status === "FAILED" || p.status === "PARTIALLY_PUBLISHED").length;
  const draftsCount = posts.filter((p) => p.status === "DRAFT").length;

  const totalPublishedOrFailed = publishedCount + failedCount;
  const successRate = totalPublishedOrFailed > 0 ? Math.round((publishedCount / totalPublishedOrFailed) * 100) : 100;

  // Aggregate Metrics across all published targets
  let totalImpressions = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalReach = 0;

  const platformEngagementTotals: Record<string, number> = {
    INSTAGRAM: 0,
    FACEBOOK: 0,
    YOUTUBE: 0,
    LINKEDIN: 0,
  };

  const platformPostCounts: Record<string, number> = {
    INSTAGRAM: 0,
    FACEBOOK: 0,
    YOUTUBE: 0,
    LINKEDIN: 0,
  };

  posts.forEach((p) => {
    p.platformTargets.forEach((t) => {
      if (platformPostCounts[t.platform] !== undefined) {
        platformPostCounts[t.platform]++;
      }

      const imps = t.impressions || 0;
      const lks = t.likes || 0;
      const coms = t.comments || 0;
      const shrs = t.shares || 0;
      const rch = t.reach || 0;

      totalImpressions += imps;
      totalLikes += lks;
      totalComments += coms;
      totalShares += shrs;
      totalReach += rch;

      const directEng = lks + coms + shrs;
      if (platformEngagementTotals[t.platform] !== undefined) {
        platformEngagementTotals[t.platform] += directEng;
      }
    });
  });

  const totalEngagements = totalLikes + totalComments + totalShares;
  const engagementRate =
    totalImpressions > 0 ? `${((totalEngagements / totalImpressions) * 100).toFixed(1)}%` : "0.0%";

  // Prepare Pie Chart data (Engagement share per platform, or post count if no engagements yet)
  const hasEngagements = totalEngagements > 0;
  const pieData = Object.entries(hasEngagements ? platformEngagementTotals : platformPostCounts).map(
    ([platform, value]) => ({
      label: platform.charAt(0) + platform.slice(1).toLowerCase(),
      value,
      color: PLATFORM_COLORS[platform] || "#6366F1",
    })
  );

  // Prepare Bar Chart data
  const barData = [
    { label: "Reach", value: totalReach || totalImpressions, color: "#6366F1" },
    { label: "Impr.", value: totalImpressions, color: "#818CF8" },
    { label: "Likes", value: totalLikes, color: "#E4405F" },
    { label: "Comms", value: totalComments, color: "#3B82F6" },
    { label: "Shares", value: totalShares, color: "#10B981" },
  ];

  const handleExportFullReport = () => {
    setIsExporting(true);
    try {
      const nowIST =
        new Date().toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        }) + " IST";

      const platformBreakdown = Object.entries(platformEngagementTotals).map(([platform, eng]) => ({
        platform,
        engagements: eng,
        percentage: totalEngagements > 0 ? Math.round((eng / totalEngagements) * 100) : 0,
        color: PLATFORM_COLORS[platform] || "#6366F1",
      }));

      generateAndPrintPdfReport({
        workspaceName,
        reportTitle: `Overall Performance & Publishing Report`,
        generatedAtIST: nowIST,
        summary: {
          totalPosts: posts.length,
          totalImpressions,
          totalLikes,
          totalComments,
          totalShares,
          engagementRate,
        },
        platformBreakdown,
        posts: posts.map((p) => {
          const pImps = p.platformTargets.reduce((s, t) => s + (t.impressions || 0), 0);
          const pLks = p.platformTargets.reduce((s, t) => s + (t.likes || 0), 0);
          const pComs = p.platformTargets.reduce((s, t) => s + (t.comments || 0), 0);
          const pShrs = p.platformTargets.reduce((s, t) => s + (t.shares || 0), 0);

          return {
            id: p.id,
            caption: p.commonCaption,
            mediaUrl: p.media[0]?.publicUrl,
            publishedAt: p.publishedAt
              ? new Date(p.publishedAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                }) + " IST"
              : p.status === "SCHEDULED"
              ? "Scheduled"
              : p.status,
            platforms: p.platformTargets.map((t) => t.platform),
            impressions: pImps,
            likes: pLks,
            comments: pComs,
            shares: pShrs,
            status: p.status,
          };
        }),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-24 md:pb-8">
      {/* Header with Export CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
            Performance Analytics & Insights — {workspaceName}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time engagement breakdown, delivery health rates, and official audit trail.
          </p>
        </div>
        <button
          onClick={handleExportFullReport}
          disabled={isExporting || posts.length === 0}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? "Preparing PDF..." : "Export Performance PDF"}</span>
        </button>
      </div>

      {/* Primary Engagement Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Audience Reach</span>
            <Eye className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {totalImpressions.toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Total Impressions</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Reactions</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {totalLikes.toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Direct Likes</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Conversations</span>
            <MessageCircle className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {(totalComments + totalShares).toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            {totalComments} comments • {totalShares} shares
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Engagement Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {engagementRate}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
            Across {posts.length} content post(s)
          </div>
        </div>
      </div>

      {/* Visual Analytics Section: Pie Chart & Bar Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Pie Chart: Platform Distribution */}
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              {hasEngagements ? "Platform Engagement Share" : "Content Distribution Share"}
            </h3>
            <span className="text-[10px] text-zinc-400">Pie Breakdown</span>
          </div>
          <div className="py-4">
            <PerformancePieChart data={pieData} size={190} />
          </div>
          <div className="text-[11px] text-center text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {hasEngagements
              ? "Relative user engagement across connected channels"
              : "Post distribution across connected channels"}
          </div>
        </div>

        {/* Bar Chart: Content Performance Metrics */}
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Overall Engagement Metrics
            </h3>
            <span className="text-[10px] text-zinc-400">Bar Comparison</span>
          </div>
          <div className="py-2">
            <PerformanceBarChart data={barData} height={180} />
          </div>
          <div className="text-[11px] text-center text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            Audience response and virality signals aggregated from all channels
          </div>
        </div>
      </div>

      {/* Secondary Status KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-white">{publishedCount}</div>
            <div className="text-[11px] text-zinc-400">Published Posts</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-white">{scheduledCount}</div>
            <div className="text-[11px] text-zinc-400">Scheduled Queued</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-white">{successRate}%</div>
            <div className="text-[11px] text-zinc-400">Delivery Health</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-white">{draftsCount}</div>
            <div className="text-[11px] text-zinc-400">Draft Ideas</div>
          </div>
        </div>
      </div>

      {/* Network Distribution & Activity Audit Log */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Network Breakdown */}
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
            Network Distribution
          </h3>

          <div className="space-y-3 text-xs">
            {Object.entries(platformPostCounts).map(([platform, count]) => {
              const totalTargets = Object.values(platformPostCounts).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((count / totalTargets) * 100);

              return (
                <div key={platform} className="space-y-1">
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">{platform}</span>
                    <span className="font-mono text-zinc-500">
                      {count} posts ({pct}%)
                    </span>
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
