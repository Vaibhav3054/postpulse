"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  ExternalLink,
  RotateCw,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileEdit,
  PenSquare,
  BarChart3,
  Download,
  CheckSquare,
  Square,
  Layers,
} from "lucide-react";
import { SocialPlatformType } from "@/lib/social-providers/types";
import { PostInsightsModal } from "./PostInsightsModal";
import { generateAndPrintPdfReport } from "@/lib/pdf-report";
import { PLATFORM_COLORS } from "../analytics/Charts";

export interface TargetItem {
  id: string;
  platform: SocialPlatformType;
  status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  externalPostUrl?: string;
  errorMessage?: string;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  clicks?: number;
  metricsUpdatedAt?: string;
}

export interface PostMediaItem {
  id: string;
  publicUrl: string;
}

export interface PostItem {
  id: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "PARTIALLY_PUBLISHED" | "FAILED";
  commonCaption: string;
  scheduledAt?: string;
  publishedAt?: string;
  timezone: string;
  media: PostMediaItem[];
  platformTargets: TargetItem[];
  createdAt: string;
}

interface PostsDashboardProps {
  posts: PostItem[];
  workspaceSlug: string;
  workspaceName?: string;
}

export function PostsDashboard({
  posts: initialPosts,
  workspaceSlug,
  workspaceName = "My Brand",
}: PostsDashboardProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [selectedTab, setSelectedTab] = useState<"ALL" | "SCHEDULED" | "PUBLISHED" | "DRAFT" | "FAILED">("ALL");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [rescheduleModalPost, setRescheduleModalPost] = useState<PostItem | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  // Insights Modal & Multi-Select State
  const [insightsPost, setInsightsPost] = useState<PostItem | null>(null);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  const filteredPosts = posts.filter((p) => {
    if (selectedTab === "ALL") return true;
    if (selectedTab === "FAILED") {
      return p.status === "FAILED" || p.status === "PARTIALLY_PUBLISHED";
    }
    return p.status === selectedTab;
  });

  const toggleSelectPost = (id: string) => {
    if (selectedPostIds.includes(id)) {
      setSelectedPostIds(selectedPostIds.filter((pId) => pId !== id));
    } else {
      setSelectedPostIds([...selectedPostIds, id]);
    }
  };

  const selectAllFiltered = () => {
    if (selectedPostIds.length === filteredPosts.length && filteredPosts.length > 0) {
      setSelectedPostIds([]);
    } else {
      setSelectedPostIds(filteredPosts.map((p) => p.id));
    }
  };

  const handleBatchExportPdf = () => {
    const selectedPosts = posts.filter((p) => selectedPostIds.includes(p.id));
    if (selectedPosts.length === 0) return;

    setIsExportingBatch(true);
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

      let totalImpressions = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;

      const platformTotals: Record<string, number> = {};

      selectedPosts.forEach((post) => {
        post.platformTargets.forEach((t) => {
          const imps = t.impressions || 0;
          const lks = t.likes || 0;
          const coms = t.comments || 0;
          const shrs = t.shares || 0;

          totalImpressions += imps;
          totalLikes += lks;
          totalComments += coms;
          totalShares += shrs;

          const eng = lks + coms + shrs;
          platformTotals[t.platform] = (platformTotals[t.platform] || 0) + eng;
        });
      });

      const totalEngagements = totalLikes + totalComments + totalShares;
      const engagementRate =
        totalImpressions > 0
          ? `${((totalEngagements / totalImpressions) * 100).toFixed(1)}%`
          : "0.0%";

      const platformBreakdown = Object.entries(platformTotals).map(([platform, eng]) => ({
        platform,
        engagements: eng,
        percentage:
          totalEngagements > 0 ? Math.round((eng / totalEngagements) * 100) : 0,
        color: PLATFORM_COLORS[platform] || "#6366F1",
      }));

      generateAndPrintPdfReport({
        workspaceName,
        reportTitle: `Batch Performance Report (${selectedPosts.length} Posts)`,
        generatedAtIST: nowIST,
        summary: {
          totalPosts: selectedPosts.length,
          totalImpressions,
          totalLikes,
          totalComments,
          totalShares,
          engagementRate,
        },
        platformBreakdown,
        posts: selectedPosts.map((p) => {
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
              : "Scheduled",
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
      setIsExportingBatch(false);
    }
  };

  const handleRetry = async (postId: string) => {
    setRetryingId(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/retry`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, status: data.post?.status || p.status } : p
          )
        );
        router.refresh();
      }
    } catch (e) {
      console.error("Retry error:", e);
    } finally {
      setRetryingId(null);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalPost || !newDate || !newTime) return;

    const updatedDateTime = new Date(`${newDate}T${newTime}:00`);

    try {
      const res = await fetch(`/api/posts/${rescheduleModalPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: updatedDateTime.toISOString(),
          status: "SCHEDULED",
        }),
      });

      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === rescheduleModalPost.id
              ? {
                  ...p,
                  scheduledAt: updatedDateTime.toISOString(),
                  status: "SCHEDULED",
                }
              : p
          )
        );
        setRescheduleModalPost(null);
        router.refresh();
      }
    } catch (e) {
      console.error("Reschedule failed:", e);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setSelectedPostIds((prev) => prev.filter((id) => id !== postId));
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: PostItem["status"]) => {
    switch (status) {
      case "PUBLISHED":
        return {
          label: "Delivered",
          bg: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
        };
      case "SCHEDULED":
        return {
          label: "Scheduled",
          bg: "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
        };
      case "DRAFT":
        return {
          label: "Draft",
          bg: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
        };
      case "FAILED":
      case "PARTIALLY_PUBLISHED":
        return {
          label: "Needs Attention",
          bg: "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
        };
      default:
        return {
          label: status,
          bg: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
        };
    }
  };

  const getPlatformIcon = (platform: SocialPlatformType) => {
    switch (platform) {
      case "INSTAGRAM":
        return <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />;
      case "FACEBOOK":
        return <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />;
      case "YOUTUBE":
        return <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />;
      case "LINKEDIN":
        return <span className="w-2.5 h-2.5 rounded-full bg-[#0A66C2] inline-block" />;
      case "GOOGLE_BUSINESS":
        return <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4] inline-block" />;
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(["ALL", "SCHEDULED", "PUBLISHED", "DRAFT", "FAILED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                selectedTab === tab
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {tab === "ALL" && `All Posts (${posts.length})`}
              {tab === "SCHEDULED" && `Scheduled (${posts.filter((p) => p.status === "SCHEDULED").length})`}
              {tab === "PUBLISHED" && `Published (${posts.filter((p) => p.status === "PUBLISHED").length})`}
              {tab === "DRAFT" && `Drafts (${posts.filter((p) => p.status === "DRAFT").length})`}
              {tab === "FAILED" && `Failed (${posts.filter((p) => p.status === "FAILED" || p.status === "PARTIALLY_PUBLISHED").length})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Select All Toggle */}
          {filteredPosts.length > 0 && (
            <button
              type="button"
              onClick={selectAllFiltered}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors"
            >
              {selectedPostIds.length === filteredPosts.length ? (
                <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span className="hidden xs:inline">Select All</span>
            </button>
          )}

          <a
            href={`/app/${workspaceSlug}/composer`}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>New Post</span>
          </a>
        </div>
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <Calendar className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            No posts found in this tab
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Schedule a post or save a draft using the unified content composer.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const statusBadge = getStatusBadge(post.status);
            const hasMedia = post.media && post.media.length > 0;
            const hasFailedTargets = post.platformTargets.some((t) => t.status === "FAILED");
            const isSelected = selectedPostIds.includes(post.id);

            // Calculate post quick metrics
            const postImpressions = post.platformTargets.reduce((s, t) => s + (t.impressions || 0), 0);
            const postEngagements = post.platformTargets.reduce(
              (s, t) => s + (t.likes || 0) + (t.comments || 0) + (t.shares || 0),
              0
            );

            return (
              <div
                key={post.id}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSelected
                    ? "border-indigo-500/80 bg-indigo-50/10 dark:bg-indigo-950/20 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                {/* Checkbox + Thumbnail + Content */}
                <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectPost(post.id)}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 mt-1 sm:mt-2"
                  />

                  {hasMedia ? (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700">
                      <img
                        src={post.media[0].publicUrl}
                        alt="media thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-400 text-xs font-mono">
                      TEXT
                    </div>
                  )}

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${statusBadge.bg}`}
                      >
                        {statusBadge.label}
                      </span>

                      {/* Target Platforms Badges */}
                      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                        {post.platformTargets.map((target) => (
                          <span
                            key={target.id}
                            title={`${target.platform}: ${target.status}`}
                            className="flex items-center gap-1"
                          >
                            {getPlatformIcon(target.platform)}
                          </span>
                        ))}
                      </div>

                      {/* Timing Info */}
                      {post.scheduledAt && post.status === "SCHEDULED" && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>
                            {new Date(post.scheduledAt).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Kolkata",
                            })}{" "}
                            IST
                          </span>
                        </span>
                      )}

                      {post.publishedAt && (
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>
                            Published{" "}
                            {new Date(post.publishedAt).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              timeZone: "Asia/Kolkata",
                            })}
                          </span>
                        </span>
                      )}

                      {/* Quick Metric Pills if published */}
                      {post.status === "PUBLISHED" && (
                        <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline-block">
                          • {postImpressions.toLocaleString()} reach • {postEngagements.toLocaleString()} eng
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-relaxed font-medium">
                      {post.commonCaption}
                    </p>

                    {/* Platform Error Notice if any */}
                    {hasFailedTargets && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {post.platformTargets.find((t) => t.status === "FAILED")?.errorMessage ||
                            "Publishing failed for one or more networks."}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center flex-wrap">
                  {/* View Insights & Performance Button */}
                  <button
                    type="button"
                    onClick={() => setInsightsPost(post)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Insights</span>
                  </button>

                  {/* One-Click Retry for Failed Posts */}
                  {hasFailedTargets && (
                    <button
                      onClick={() => handleRetry(post.id)}
                      disabled={retryingId === post.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-semibold hover:bg-rose-100 transition-colors"
                    >
                      <RotateCw className={`w-3 h-3 ${retryingId === post.id ? "animate-spin" : ""}`} />
                      <span>Retry Failed</span>
                    </button>
                  )}

                  {/* Reschedule Button */}
                  {post.status === "SCHEDULED" && (
                    <button
                      onClick={() => {
                        setRescheduleModalPost(post);
                        if (post.scheduledAt) {
                          const d = new Date(post.scheduledAt);
                          setNewDate(d.toISOString().split("T")[0]);
                          setNewTime(d.toTimeString().substring(0, 5));
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium"
                    >
                      Reschedule
                    </button>
                  )}

                  {/* External links for published posts */}
                  {post.platformTargets
                    .filter((t) => t.externalPostUrl)
                    .map((t) => (
                      <a
                        key={t.id}
                        href={t.externalPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title={`View on ${t.platform}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ))}

                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Delete post"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Batch Action Bar when posts are selected */}
      {selectedPostIds.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 dark:bg-zinc-800/95 text-white border border-zinc-700/80 backdrop-blur-md rounded-full px-5 py-2.5 shadow-2xl flex items-center gap-3.5 animate-slide-up">
          <span className="text-xs font-semibold whitespace-nowrap">
            {selectedPostIds.length} post{selectedPostIds.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            onClick={handleBatchExportPdf}
            disabled={isExportingBatch}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-full text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingBatch ? "Generating..." : "Export Selected to PDF"}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedPostIds([])}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Post Insights Modal */}
      {insightsPost && (
        <PostInsightsModal
          post={insightsPost}
          workspaceName={workspaceName}
          onClose={() => setInsightsPost(null)}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Reschedule Post
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Choose a new publish date and time (IST).
              </p>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Time (IST)
                </label>
                <input
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModalPost(null)}
                  className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
