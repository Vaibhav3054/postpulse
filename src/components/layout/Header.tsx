"use client";

import { PenSquare, RefreshCw, Menu, Bell, AlertTriangle, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMobileNav } from "./AppShell";

interface HeaderProps {
  title: string;
  workspaceSlug: string;
  connectedCount?: number;
  scheduledCount?: number;
}

interface WorkspaceNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function Header({
  title,
  workspaceSlug,
}: HeaderProps) {
  const { openMobileSidebar, workspaceId } = useMobileNav();
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/notifications?workspaceId=${encodeURIComponent(workspaceId)}&limit=12`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [workspaceId]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [notifOpen]);

  const handleMarkAllRead = async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, markAll: true }),
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      // Non-blocking
    }
  };

  const handleManualDispatch = async () => {
    setIsDispatching(true);
    setDispatchMessage(null);
    try {
      const res = await fetch("/api/publishing/dispatch", { method: "POST" });
      const data = await res.json();
      setDispatchMessage(`Processed ${data.processedCount || 0} due target(s).`);
      loadNotifications();
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
        {/* In-App Publishing & Alert Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((o) => !o);
              if (!notifOpen) loadNotifications();
            }}
            aria-label="Publishing notifications"
            className="relative p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Publishing Alerts
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500">
                    No publishing alerts yet. Everything is running smoothly.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs space-y-1 ${
                        n.isRead
                          ? "bg-transparent opacity-75"
                          : "bg-indigo-50/40 dark:bg-indigo-950/20"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            n.type === "TOKEN_EXPIRED" || n.type === "ACCOUNT_DISCONNECTED"
                              ? "text-amber-500"
                              : "text-rose-500"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-zinc-900 dark:text-white">
                            {n.title}
                          </div>
                          <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-snug mt-0.5 break-words">
                            {n.message}
                          </p>
                          <div className="text-[10px] text-zinc-400 mt-1">
                            {new Date(n.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Worker Dispatch Trigger for manual sync */}
        <button
          onClick={handleManualDispatch}
          disabled={isDispatching}
          title="Manually trigger background publishing dispatcher for due posts"
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
