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
  ListFilter,
  CheckCircle2,
  AlertCircle,
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
  const [viewMode, setViewMode] = useState<"MONTH" | "AGENDA">("MONTH");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);

  // Month navigation
  const nextPeriod = () => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const prevPeriod = () => {
    const prev = new Date(currentDate);
    prev.setMonth(prev.getMonth() - 1);
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
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
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

  // Next month leading days to complete 42 slots (6 weeks)
  const remainingSlots = 42 - days.length;
  for (let i = 1; i <= remainingSlots; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  // Drag-and-drop reschedule
  const handleDragStart = (e: React.DragEvent, postId: string) => {
    e.dataTransfer.setData("text/plain", postId);
    setDraggedPostId(postId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnDate = async (targetDate: Date) => {
    if (!draggedPostId) return;

    const postToUpdate = posts.find((p) => p.id === draggedPostId);
    if (!postToUpdate) return;

    const originalTime = postToUpdate.scheduledAt
      ? new Date(postToUpdate.scheduledAt)
      : new Date();
    const newScheduledAt = new Date(targetDate);
    newScheduledAt.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === draggedPostId
          ? {
              ...p,
              scheduledAt: newScheduledAt.toISOString(),
              status: "SCHEDULED",
            }
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

  // Sorted posts for Agenda list
  const agendaPosts = [...filteredPosts].sort((a, b) => {
    const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return timeA - timeB;
  });

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Calendar Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between sm:justify-start gap-3">
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

          <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white tracking-tight">
            {currentDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </h2>
        </div>

        {/* Filters, View Switcher & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* View Mode Switcher: Grid vs Agenda */}
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setViewMode("MONTH")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === "MONTH"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode("AGENDA")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === "AGENDA"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Agenda
            </button>
          </div>

          {/* Platform Filter */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm ml-auto sm:ml-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Schedule</span>
          </a>
        </div>
      </div>

      {/* VIEW: AGENDA LIST (Mobile-First / Compact Chronological View) */}
      {viewMode === "AGENDA" ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Scheduled Content Pipeline (IST)
            </h3>
            <span className="text-xs text-zinc-400 font-mono">
              {agendaPosts.length} post{agendaPosts.length === 1 ? "" : "s"}
            </span>
          </div>

          {agendaPosts.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400 space-y-2">
              <CalendarIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
              <p>No content scheduled for this period.</p>
              <a
                href={`/app/${workspaceSlug}/composer`}
                className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create a new scheduled post</span>
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {agendaPosts.map((post) => {
                const dateObj = post.scheduledAt ? new Date(post.scheduledAt) : null;
                const isPublished = post.status === "PUBLISHED";
                const isFailed = post.status === "FAILED";

                return (
                  <div
                    key={post.id}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:border-zinc-300"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Target Channels */}
                        <div className="flex items-center gap-1">
                          {post.platformTargets.map((t) => (
                            <span
                              key={t.id}
                              className={`w-2.5 h-2.5 rounded-full ${getPlatformChipColor(
                                t.platform
                              )}`}
                              title={t.platform}
                            />
                          ))}
                        </div>

                        {/* Date & Time Badge */}
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span>
                            {dateObj
                              ? dateObj.toLocaleString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Asia/Kolkata",
                                }) + " IST"
                              : "Draft"}
                          </span>
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isPublished
                              ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                              : isFailed
                              ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400"
                              : "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400"
                          }`}
                        >
                          {post.status}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2">
                        {post.commonCaption}
                      </p>
                    </div>

                    <a
                      href={`/app/${workspaceSlug}/posts`}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 self-start sm:self-auto shrink-0"
                    >
                      <span>View in Posts</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW: MONTH VIEW GRID (With smooth horizontal scroll for mobile) */
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 overflow-x-auto shadow-sm">
          <div className="min-w-[650px]">
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
        </div>
      )}

      <div className="text-xs text-zinc-500 text-center flex items-center justify-center gap-2">
        <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
        <span>Tip: Drag and drop any scheduled post card directly onto another date to reschedule instantly.</span>
      </div>
    </div>
  );
}
