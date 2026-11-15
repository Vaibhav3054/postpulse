"use client";

import Link from "next/navigation";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PenSquare,
  FileText,
  CalendarDays,
  Image as ImageIcon,
  BarChart3,
  Share2,
  Settings,
  ChevronDown,
  Plus,
  Sparkles,
  LogOut,
  Building2,
} from "lucide-react";
import { useState } from "react";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  planId: string;
  planName: string;
  role: string;
}

interface UserInfo {
  id: string;
  email: string;
  fullName?: string | null;
}

interface SidebarProps {
  currentWorkspace: WorkspaceInfo;
  workspaces: WorkspaceInfo[];
  user: UserInfo;
  onOpenCreateWorkspace: () => void;
}

export function Sidebar({
  currentWorkspace,
  workspaces,
  user,
  onOpenCreateWorkspace,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const slug = currentWorkspace.slug;

  const navItems = [
    {
      label: "Dashboard",
      href: `/app/${slug}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      label: "Create Post",
      href: `/app/${slug}/composer`,
      icon: PenSquare,
      highlight: true,
    },
    {
      label: "Posts",
      href: `/app/${slug}/posts`,
      icon: FileText,
    },
    {
      label: "Calendar",
      href: `/app/${slug}/calendar`,
      icon: CalendarDays,
    },
    {
      label: "Media Library",
      href: `/app/${slug}/media`,
      icon: ImageIcon,
    },
    {
      label: "Social Accounts",
      href: `/app/${slug}/social-accounts`,
      icon: Share2,
    },
    {
      label: "Analytics",
      href: `/app/${slug}/analytics`,
      icon: BarChart3,
    },
    {
      label: "Settings",
      href: `/app/${slug}/settings`,
      icon: Settings,
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col h-screen select-none shrink-0">
      {/* Brand & Workspace Switcher Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-sm shadow-indigo-600/30">
            P
          </div>
          <span className="font-semibold text-zinc-900 dark:text-white tracking-tight text-base">
            PostPulse
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded ml-auto">
            v1.0
          </span>
        </div>

        {/* Workspace Dropdown Trigger */}
        <div className="relative">
          <button
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-zinc-600 dark:text-zinc-300">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                  {currentWorkspace.name}
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 capitalize">
                  {currentWorkspace.planName}
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>

          {/* Workspace Dropdown Menu */}
          {isWorkspaceMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 p-1 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl z-50">
              <div className="text-[10px] font-medium text-zinc-400 px-2 py-1 uppercase tracking-wider">
                Switch Brand / Workspace
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setIsWorkspaceMenuOpen(false);
                    router.push(`/app/${ws.slug}/dashboard`);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                    ws.id === currentWorkspace.id
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  <span className="text-[10px] text-zinc-400 uppercase font-mono">
                    {ws.planId}
                  </span>
                </button>
              ))}
              <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
              <button
                onClick={() => {
                  setIsWorkspaceMenuOpen(false);
                  onOpenCreateWorkspace();
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.highlight) {
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-3 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/20">
                  New
                </span>
              </a>
            );
          }

          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* Plan Quota Card */}
      <div className="p-3 mx-3 mb-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs">
        <div className="flex items-center justify-between text-zinc-900 dark:text-white font-medium mb-1">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            {currentWorkspace.planName}
          </span>
          <a
            href={`/app/${slug}/settings`}
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            Manage
          </a>
        </div>
        <p className="text-[11px] text-zinc-500 leading-tight">
          Official APIs connected. Free-tier cloud storage active.
        </p>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 relative">
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex items-center justify-center shrink-0">
            {user.fullName ? user.fullName[0].toUpperCase() : user.email[0].toUpperCase()}
          </div>
          <div className="truncate flex-1">
            <div className="text-xs font-medium text-zinc-900 dark:text-white truncate">
              {user.fullName || "Creator"}
            </div>
            <div className="text-[11px] text-zinc-400 truncate">{user.email}</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        {isUserMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 p-1 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl z-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
