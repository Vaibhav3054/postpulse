"use client";

import { useState } from "react";
import {
  X,
  BarChart3,
  ExternalLink,
  Download,
  Share2,
  Heart,
  MessageCircle,
  Eye,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { PostItem } from "./PostsDashboard";
import {
  PerformancePieChart,
  PerformanceBarChart,
  PLATFORM_COLORS,
} from "../analytics/Charts";
import { generateAndPrintPdfReport } from "@/lib/pdf-report";

interface PostInsightsModalProps {
  post: PostItem;
  workspaceName: string;
  onClose: () => void;
}

export function PostInsightsModal({
  post,
  workspaceName,
  onClose,
}: PostInsightsModalProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Calculate aggregated metrics across all targets
  const totalImpressions = post.platformTargets.reduce(
    (sum, t) => sum + (t.impressions || 0),
    0
  );
  const totalLikes = post.platformTargets.reduce(
    (sum, t) => sum + (t.likes || 0),
    0
  );
  const totalComments = post.platformTargets.reduce(
    (sum, t) => sum + (t.comments || 0),
    0
  );
  const totalShares = post.platformTargets.reduce(
    (sum, t) => sum + (t.shares || 0),
    0
  );
  const totalEngagements = totalLikes + totalComments + totalShares;

  const engagementRate =
    totalImpressions > 0
      ? `${((totalEngagements / totalImpressions) * 100).toFixed(1)}%`
      : "0.0%";

  // Prepare Pie Chart Data (Platform engagement distribution)
  const pieData = post.platformTargets.map((t) => {
    const targetEngagements =
      (t.likes || 0) + (t.comments || 0) + (t.shares || 0);
    return {
      label: t.platform,
      value: targetEngagements,
      color: PLATFORM_COLORS[t.platform] || "#6366F1",
    };
  });

  // Prepare Bar Chart Data (Reach vs Engagements)
  const barData = [
    { label: "Reach", value: totalImpressions, color: "#6366F1" },
    { label: "Likes", value: totalLikes, color: "#EC4899" },
    { label: "Comments", value: totalComments, color: "#10B981" },
    { label: "Shares", value: totalShares, color: "#F59E0B" },
  ];

  // Handle Export Single Post PDF
  const handleExportPdf = () => {
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

      const totalPieVal = pieData.reduce((s, p) => s + p.value, 0);

      generateAndPrintPdfReport({
        workspaceName,
        reportTitle: "Single Post Performance Insights",
        generatedAtIST: nowIST,
        summary: {
          totalPosts: 1,
          totalImpressions,
          totalLikes,
          totalComments,
          totalShares,
          engagementRate,
        },
        platformBreakdown: pieData.map((p) => ({
          platform: p.label,
          engagements: p.value,
          percentage:
            totalPieVal > 0 ? Math.round((p.value / totalPieVal) * 100) : 0,
          color: p.color,
        })),
        posts: [
          {
            id: post.id,
            caption: post.commonCaption,
            mediaUrl: post.media[0]?.publicUrl,
            publishedAt: post.publishedAt
              ? new Date(post.publishedAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                }) + " IST"
              : "Draft",
            platforms: post.platformTargets.map((t) => t.platform),
            impressions: totalImpressions,
            likes: totalLikes,
            comments: totalComments,
            shares: totalShares,
            status: post.status,
          },
        ],
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                Post Insights & Performance
              </h2>
              <p className="text-[11px] text-zinc-500">
                Verified analytics across connected social networks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Post Snippet */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 flex items-start gap-3.5">
            {post.media[0] ? (
              <img
                src={post.media[0].publicUrl}
                alt="Post attachment"
                className="w-14 h-14 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs shrink-0">
                Text
              </div>
            )}

            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {post.platformTargets.map((t) => (
                    <span
                      key={t.id}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                      style={{
                        backgroundColor:
                          PLATFORM_COLORS[t.platform] || "#6366F1",
                      }}
                    >
                      {t.platform}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata",
                      }) + " IST"
                    : "Draft"}
                </span>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2">
                {post.commonCaption}
              </p>
            </div>
          </div>

          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-center gap-1">
                <Eye className="w-3 h-3 text-indigo-500" />
                <span>Impressions</span>
              </div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                {totalImpressions.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-center gap-1">
                <Heart className="w-3 h-3 text-pink-500" />
                <span>Likes</span>
              </div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                {totalLikes.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-center gap-1">
                <MessageCircle className="w-3 h-3 text-emerald-500" />
                <span>Comments</span>
              </div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                {totalComments.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3 text-purple-500" />
                <span>Engage Rate</span>
              </div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                {engagementRate}
              </div>
            </div>
          </div>

          {/* Dual Visual Charts (Pie + Bar) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40">
            <div className="flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-0 sm:pr-4">
              <PerformancePieChart
                title="Platform Engagement Share"
                data={pieData}
                size={160}
              />
            </div>

            <div className="flex flex-col justify-center sm:pl-2">
              <PerformanceBarChart
                title="Reach vs Direct Engagements"
                data={barData}
                height={140}
              />
            </div>
          </div>

          {/* Network-by-Network Detailed Status */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Connected Networks Breakdown
            </div>
            <div className="space-y-2">
              {post.platformTargets.map((t) => {
                const targetEngagements =
                  (t.likes || 0) + (t.comments || 0) + (t.shares || 0);

                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            PLATFORM_COLORS[t.platform] || "#6366F1",
                        }}
                      />
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {t.platform}
                      </span>
                      {t.status === "PUBLISHED" ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                          Live
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                          {t.status}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-semibold text-zinc-900 dark:text-white">
                          {t.impressions || 0} reach • {targetEngagements} eng
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {t.likes || 0} likes • {t.comments || 0} comments
                        </div>
                      </div>

                      {t.externalPostUrl && (
                        <a
                          href={t.externalPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-indigo-500 transition-colors"
                          title="Open live post"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-zinc-400">
            {totalImpressions === 0 &&
              "Live metrics update automatically when live accounts publish."}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Generating..." : "Download PDF Report"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
