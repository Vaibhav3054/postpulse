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
} from "lucide-react";
import { SocialPlatformType } from "@/lib/social-providers/types";

interface TargetItem {
  id: string;
  platform: SocialPlatformType;
  status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  externalPostUrl?: string;
  errorMessage?: string;
}

interface PostMediaItem {
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
}

export function PostsDashboard({ posts: initialPosts, workspaceSlug }: PostsDashboardProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [selectedTab, setSelectedTab] = useState<"ALL" | "SCHEDULED" | "PUBLISHED" | "DRAFT" | "FAILED">("ALL");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [rescheduleModalPost, setRescheduleModalPost] = useState<PostItem | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const filteredPosts = posts.filter((p) => {
    if (selectedTab === "ALL") return true;
    if (selectedTab === "FAILED") {
      return p.status === "FAILED" || p.status === "PARTIALLY_PUBLISHED";
    }
    return p.status === selectedTab;
  });

  const handleRetry = async (postId: string) => {
    setRetryingId(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/retry`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.post) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicate = async (post: PostItem) => {
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: posts[0]?.id ? posts[0].id : "", // will be handled
          status: "DRAFT",
          commonCaption: `Copy of: ${post.commonCaption}`,
          mediaAssetIds: post.media.map((m) => m.id),
          targets: post.platformTargets.map((t) => ({
            socialAccountId: "acc_demo",
            platform: t.platform,
          })),
        }),
      });
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveReschedule = async () => {
    if (!rescheduleModalPost || !newDate || !newTime) return;
    try {
      const scheduledAt = new Date(`${newDate}T${newTime}:00`).toISOString();
      const res = await fetch(`/api/posts/${rescheduleModalPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, status: "SCHEDULED" }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        setPosts((prev) => prev.map((p) => (p.id === rescheduleModalPost.id ? data.post : p)));
      }
      setRescheduleModalPost(null);
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: PostItem["status"]) => {
    switch (status) {
      case "PUBLISHED":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
          label: "Published",
        };
      case "SCHEDULED":
        return {
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800",
          label: "Scheduled",
        };
      case "PUBLISHING":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
          label: "Publishing...",
        };
      case "PARTIALLY_PUBLISHED":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
          label: "Partially Published",
        };
      case "FAILED":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
          label: "Failed",
        };
      case "DRAFT":
      default:
        return {
          bg: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
          label: "Draft",
        };
    }
  };

  const getPlatformIcon = (platform: SocialPlatformType) => {
    switch (platform) {
      case "INSTAGRAM":
        return <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 inline-block" />;
      case "FACEBOOK":
        return <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2] inline-block" />;
      case "YOUTUBE":
        return <span className="w-2.5 h-2.5 rounded-full bg-[#FF0000] inline-block" />;
      case "LINKEDIN":
        return <span className="w-2.5 h-2.5 rounded-full bg-[#0A66C2] inline-block" />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header bar & tab filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
          {(["ALL", "SCHEDULED", "PUBLISHED", "DRAFT", "FAILED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedTab === tab
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {tab === "ALL" && "All Posts"}
              {tab === "SCHEDULED" && "Scheduled"}
              {tab === "PUBLISHED" && "Published"}
              {tab === "DRAFT" && "Drafts"}
              {tab === "FAILED" && "Failed"}
            </button>
          ))}
        </div>

        <a
          href={`/app/${workspaceSlug}/composer`}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <PenSquare className="w-3.5 h-3.5" />
          <span>New Post</span>
        </a>
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

            return (
              <div
                key={post.id}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Media thumbnail + caption content */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {hasMedia ? (
                    <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700">
                      <img
                        src={post.media[0].publicUrl}
                        alt="media thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-400 text-xs font-mono">
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
                            {new Date(post.scheduledAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}{" "}
                            ({post.timezone})
                          </span>
                        </span>
                      )}

                      {post.publishedAt && (
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>
                            Published {new Date(post.publishedAt).toLocaleDateString()}
                          </span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-relaxed">
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
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
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
                        rel="noreferrer"
                        title={`View on ${t.platform}`}
                        className="p-1.5 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ))}

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(post.id)}
                    title="Delete post"
                    className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Reschedule Post
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">New Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setRescheduleModalPost(null)}
                className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReschedule}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                Update Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
