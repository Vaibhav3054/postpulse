"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Plus,
  PenSquare,
} from "lucide-react";
import { PostItem } from "../posts/PostsDashboard";
import { SocialPlatformType } from "@/lib/social-providers/types";

interface ContentCalendarProps {
  posts: PostItem[];
  workspaceSlug: string;
}

export function ContentCalendar({ posts: initialPosts, workspaceSlug }: ContentCalendarProps) {
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"MONTH" | "WEEK" | "DAY">("MONTH");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);

  // Month navigation
  const nextPeriod = () => {
    const next = new Date(currentDate);
    if (viewMode === "MONTH") next.setMonth(next.getMonth() + 1);
    else if (viewMode === "WEEK") next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const prevPeriod = () => {
    const prev = new Date(currentDate);
    if (viewMode === "MONTH") prev.setMonth(prev.getMonth() - 1);
    else if (viewMode === "WEEK") prev.setDate(prev.getDate() - 7);
    else prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
  };

  const today = () => setCurrentDate(new Date());

  // Filter posts by platform
  const filteredPosts = posts.filter((p) => {
    if (selectedPlatform === "ALL") return true;
    return p.platformTargets.some(
      (t) => t.platform.toUpperCase() === selectedPlatform.toUpperCase()
    );
  });

  // Calculate Month Days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill 35 or 42 cells
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  // Drag-and-drop reschedule handler
  const handleDragStart = (e: React.DragEvent, postId: string) => {
    e.dataTransfer.setData("text/plain", postId);
    setDraggedPostId(postId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnDate = async (targetDate: Date) => {
    if (!draggedPostId) return;

    const post = posts.find((p) => p.id === draggedPostId);
    if (!post) return;

    // Retain existing hour/minute from post.scheduledAt if available, else 18:30
    const existingTime = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
    const newScheduledAt = new Date(targetDate);
    newScheduledAt.setHours(existingTime.getHours(), existingTime.getMinutes(), 0, 0);

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === draggedPostId
          ? { ...p, scheduledAt: newScheduledAt.toISOString(), status: "SCHEDULED" }
          : p
      )
    );

    setDraggedPostId(null);

    try {
      await fetch(`/api/posts/${draggedPostId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: newScheduledAt.toISOString(),
          status: "SCHEDULED",
        }),
      });
    } catch (e) {
      console.error("Failed to reschedule post via drag-and-drop:", e);
    }
  };

  const getPlatformChipColor = (platform: SocialPlatformType) => {
    switch (platform) {
      case "INSTAGRAM":
        return "bg-rose-500";
      case "FACEBOOK":
        return "bg-blue-600";
      case "YOUTUBE":
        return "bg-red-600";
      case "LINKEDIN":
        return "bg-[#0A66C2]";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Calendar Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={prevPeriod}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={today}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Today
            </button>
            <button
              onClick={nextPeriod}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">
            {currentDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </h2>
        </div>

        {/* Filters & View Switchers */}
        <div className="flex items-center gap-3">
          {/* Platform Filter */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="ALL">All Networks</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="LINKEDIN">LinkedIn</option>
          </select>

          {/* New Post CTA */}
          <a
            href={`/app/${workspaceSlug}/composer`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Post</span>
          </a>
        </div>
      </div>

      {/* MONTH VIEW GRID */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 text-center text-xs font-semibold text-zinc-500 py-2.5 bg-zinc-50/50 dark:bg-zinc-900/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 grid-rows-6">
          {days.map((dayObj, idx) => {
            const dateStr = dayObj.date.toISOString().split("T")[0];
            const isToday = dayObj.date.toDateString() === new Date().toDateString();

            // Find posts scheduled or published on this date
            const dayPosts = filteredPosts.filter((p) => {
              const d = p.scheduledAt || p.publishedAt;
              if (!d) return false;
              return new Date(d).toISOString().split("T")[0] === dateStr;
            });

            return (
              <div
                key={idx}
                onDragOver={handleDragOver}
                onDrop={() => handleDropOnDate(dayObj.date)}
                className={`min-h-[110px] p-2 border-b border-r border-zinc-100 dark:border-zinc-900 relative transition-colors ${
                  !dayObj.isCurrentMonth
                    ? "bg-zinc-50/40 dark:bg-zinc-900/20 text-zinc-400"
                    : "bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200"
                } ${isToday ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {dayObj.date.getDate()}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] font-mono text-zinc-400">
                      {dayPosts.length}
                    </span>
                  )}
                </div>

                {/* Post Chips inside day cell */}
                <div className="space-y-1 overflow-y-auto max-h-[80px]">
                  {dayPosts.map((post) => {
                    const isPublished = post.status === "PUBLISHED";
                    const isFailed = post.status === "FAILED";

                    return (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, post.id)}
                        className={`p-1.5 rounded-md border text-[11px] cursor-grab active:cursor-grabbing hover:shadow-sm transition-all select-none ${
                          isPublished
                            ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
                            : isFailed
                            ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-200"
                            : "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {/* Channel colored dots */}
                          <div className="flex items-center -space-x-1">
                            {post.platformTargets.map((t) => (
                              <span
                                key={t.id}
                                className={`w-2 h-2 rounded-full border border-white dark:border-black ${getPlatformChipColor(
                                  t.platform
                                )}`}
                              />
                            ))}
                          </div>
                          <span className="text-[9px] font-mono opacity-75 truncate">
                            {post.scheduledAt
                              ? new Date(post.scheduledAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Draft"}
                          </span>
                        </div>
                        <p className="line-clamp-1 leading-tight text-[11px] font-medium">
                          {post.commonCaption}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-zinc-500 text-center flex items-center justify-center gap-2">
        <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
        <span>Tip: Drag and drop any scheduled post card directly onto another date to reschedule instantly.</span>
      </div>
    </div>
  );
}
