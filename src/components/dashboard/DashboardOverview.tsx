"use client";

import {
  Calendar,
  Clock,
  Share2,
  CheckCircle2,
  AlertCircle,
  PenSquare,
  ArrowRight,
  TrendingUp,
  RotateCw,
} from "lucide-react";
import { PostItem } from "../posts/PostsDashboard";
import { ConnectedAccountItem } from "../composer/AccountSelector";
import { SocialPlatformType } from "@/lib/social-providers/types";

interface DashboardOverviewProps {
  workspaceName: string;
  workspaceSlug: string;
  accounts: ConnectedAccountItem[];
  posts: PostItem[];
}

export function DashboardOverview({
  workspaceName,
  workspaceSlug,
  accounts,
  posts,
}: DashboardOverviewProps) {
  const scheduledPosts = posts.filter((p) => p.status === "SCHEDULED");
  const publishedPosts = posts.filter((p) => p.status === "PUBLISHED");
  const failedPosts = posts.filter((p) => p.status === "FAILED" || p.status === "PARTIALLY_PUBLISHED");

  const upcomingPosts = [...scheduledPosts].sort((a, b) => {
    const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return timeA - timeB;
  }).slice(0, 3);

  const recentlyPublished = [...publishedPosts].sort((a, b) => {
    const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return timeB - timeA;
  }).slice(0, 3);

  const getPlatformDot = (platform: SocialPlatformType) => {
    switch (platform) {
      case "INSTAGRAM":
        return <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />;
      case "FACEBOOK":
        return <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />;
      case "YOUTUBE":
        return <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />;
      case "LINKEDIN":
        return <span className="w-2 h-2 rounded-full bg-[#0A66C2] inline-block" />;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Welcome back to {workspaceName}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Here is your scheduled publishing pipeline and channel health today.
          </p>
        </div>

        <a
          href={`/app/${workspaceSlug}/composer`}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/30 transition-all self-start sm:self-auto"
        >
          <PenSquare className="w-3.5 h-3.5" />
          <span>Create Post</span>
        </a>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Connected Accounts */}
        <a
          href={`/app/${workspaceSlug}/social-accounts`}
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-zinc-300 transition-colors block"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Channels</span>
            <Share2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {accounts.length}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Official OAuth active</div>
        </a>

        {/* Scheduled Posts */}
        <a
          href={`/app/${workspaceSlug}/calendar`}
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-zinc-300 transition-colors block"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Scheduled</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {scheduledPosts.length}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Due for publishing</div>
        </a>

        {/* Published Posts */}
        <a
          href={`/app/${workspaceSlug}/posts`}
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-zinc-300 transition-colors block"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {publishedPosts.length}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Published successfully</div>
        </a>

        {/* Failed Requiring Attention */}
        <a
          href={`/app/${workspaceSlug}/posts`}
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-zinc-300 transition-colors block"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Attention</span>
            <AlertCircle className={`w-4 h-4 ${failedPosts.length > 0 ? "text-rose-500" : "text-zinc-400"}`} />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {failedPosts.length}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Failed delivery attempts</div>
        </a>
      </div>

      {/* Two Columns: Upcoming Scheduled & Recently Published */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Scheduled */}
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Upcoming Scheduled Content</span>
            </h3>
            <a
              href={`/app/${workspaceSlug}/calendar`}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View Calendar</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          {upcomingPosts.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-100 dark:border-zinc-800 rounded-lg text-xs text-zinc-400">
              No upcoming scheduled posts.
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center -space-x-1">
                        {post.platformTargets.map((t) => (
                          <span key={t.id}>{getPlatformDot(t.platform)}</span>
                        ))}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {post.scheduledAt
                          ? new Date(post.scheduledAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 line-clamp-1 font-medium">
                      {post.commonCaption}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Published */}
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Recently Published</span>
            </h3>
            <a
              href={`/app/${workspaceSlug}/posts`}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          {recentlyPublished.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-100 dark:border-zinc-800 rounded-lg text-xs text-zinc-400">
              No published posts yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentlyPublished.map((post) => (
                <div
                  key={post.id}
                  className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center -space-x-1">
                        {post.platformTargets.map((t) => (
                          <span key={t.id}>{getPlatformDot(t.platform)}</span>
                        ))}
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 line-clamp-1">
                      {post.commonCaption}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
