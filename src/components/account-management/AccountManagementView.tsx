"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Share2,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Plus,
  RefreshCw,
  ExternalLink,
  FlaskConical,
} from "lucide-react";
import { GoogleBusinessManager } from "./GoogleBusinessManager";
import { FacebookPageManager } from "./FacebookPageManager";
import { InstagramProfileView } from "./InstagramProfileView";
import { LinkedInOrganizationView } from "./LinkedInOrganizationView";
import { SocialPlatformType } from "@/lib/social-providers/types";
import type { ProviderIntegrationStatus } from "@/lib/social-providers/oauth-service";

interface SocialAccountItem {
  id: string;
  platform: SocialPlatformType;
  platformAccountId: string;
  platformUsername?: string | null;
  platformDisplayName?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
  isActive: boolean;
}

interface ActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface AccountManagementViewProps {
  accounts: SocialAccountItem[];
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  gbpLocation: any | null;
  logs: ActivityLogItem[];
  providerStatuses?: Record<SocialPlatformType, ProviderIntegrationStatus>;
}

export function AccountManagementView({
  accounts,
  workspaceId,
  workspaceSlug,
  workspaceName,
  gbpLocation,
  logs,
  providerStatuses,
}: AccountManagementViewProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatformType>("GOOGLE_BUSINESS");
  const isSelectedLive = providerStatuses?.[selectedPlatform]?.mode === "live";

  const gbpAccount = accounts.find((a) => a.platform === "GOOGLE_BUSINESS");
  const fbAccount = accounts.find((a) => a.platform === "FACEBOOK");
  const igAccount = accounts.find((a) => a.platform === "INSTAGRAM");
  const liAccount = accounts.find((a) => a.platform === "LINKEDIN");

  const platformTabs = [
    {
      platform: "GOOGLE_BUSINESS" as const,
      name: "Google Business",
      icon: "G",
      bg: "bg-[#4285F4] text-white",
      isConnected: Boolean(gbpAccount),
      accountDisplayName: gbpAccount?.platformDisplayName || gbpAccount?.platformUsername,
    },
    {
      platform: "FACEBOOK" as const,
      name: "Facebook Pages",
      icon: "F",
      bg: "bg-[#1877F2] text-white",
      isConnected: Boolean(fbAccount),
      accountDisplayName: fbAccount?.platformDisplayName || fbAccount?.platformUsername,
    },
    {
      platform: "INSTAGRAM" as const,
      name: "Instagram",
      icon: "I",
      bg: "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white",
      isConnected: Boolean(igAccount),
      accountDisplayName: igAccount?.platformDisplayName || igAccount?.platformUsername,
    },
    {
      platform: "LINKEDIN" as const,
      name: "LinkedIn",
      icon: "in",
      bg: "bg-[#0A66C2] text-white",
      isConnected: Boolean(liAccount),
      accountDisplayName: liAccount?.platformDisplayName || liAccount?.platformUsername,
    },
  ];

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6 pb-24 md:pb-12 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Account Management
            </h2>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
              {workspaceName}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-2xl">
            Manage store hours, Google Maps details, customer review replies, and official profile metadata across your authorized channels.
          </p>
        </div>

        {isSelectedLive ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold self-start sm:self-auto shrink-0 shadow-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Live Official OAuth Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold self-start sm:self-auto shrink-0 shadow-sm">
            <FlaskConical className="w-4 h-4" />
            <span>Sandbox Mode (Mock Sync)</span>
          </div>
        )}
      </div>

      {/* Primary Platform Selector Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {platformTabs.map((tab) => {
          const isSelected = selectedPlatform === tab.platform;

          return (
            <button
              key={tab.platform}
              type="button"
              onClick={() => setSelectedPlatform(tab.platform)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-md ring-2 ring-blue-500/20"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${tab.bg}`}
                >
                  {tab.icon}
                </div>
                {tab.isConnected ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-400">Offline</span>
                )}
              </div>

              <div className="mt-3">
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                  {tab.name}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-1">
                  {tab.accountDisplayName || "Not connected"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ACTIVE TAB CONTENT */}
      <div className="pt-2 w-full max-w-full min-w-0">
        {/* GOOGLE BUSINESS PROFILE */}
        {selectedPlatform === "GOOGLE_BUSINESS" && (
          <>
            {gbpAccount && gbpLocation ? (
              <GoogleBusinessManager
                location={gbpLocation}
                workspaceId={workspaceId}
                socialAccountId={gbpAccount.id}
              />
            ) : (
              <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3">
                <Building2 className="w-10 h-10 text-zinc-400 mx-auto" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Google Business Profile Not Connected
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Connect your Google account to manage business hours, physical address, photos, and customer review replies directly from PostPulse.
                </p>
                <div className="pt-2">
                  <Link
                    href={`/app/${workspaceSlug}/social-accounts`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#4285F4] hover:bg-blue-600 rounded-xl shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Connect Google Business Profile</span>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* FACEBOOK PAGES */}
        {selectedPlatform === "FACEBOOK" && (
          <>
            {fbAccount ? (
              <FacebookPageManager account={fbAccount} workspaceId={workspaceId} />
            ) : (
              <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3">
                <Share2 className="w-10 h-10 text-zinc-400 mx-auto" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Facebook Page Not Connected
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Connect a Facebook Page to update page about text, phone numbers, website, and operating hours.
                </p>
                <div className="pt-2">
                  <Link
                    href={`/app/${workspaceSlug}/social-accounts`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1877F2] hover:bg-blue-600 rounded-xl shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Connect Facebook Page</span>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* INSTAGRAM PROFESSIONAL */}
        {selectedPlatform === "INSTAGRAM" && (
          <>
            {igAccount ? (
              <InstagramProfileView account={igAccount} />
            ) : (
              <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3">
                <Share2 className="w-10 h-10 text-zinc-400 mx-auto" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Instagram Account Not Connected
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Connect your Instagram Professional or Creator account to monitor audience metrics and access direct profile controls.
                </p>
                <div className="pt-2">
                  <Link
                    href={`/app/${workspaceSlug}/social-accounts`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Connect Instagram Account</span>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* LINKEDIN */}
        {selectedPlatform === "LINKEDIN" && (
          <>
            {liAccount ? (
              <LinkedInOrganizationView account={liAccount} />
            ) : (
              <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3">
                <Building2 className="w-10 h-10 text-zinc-400 mx-auto" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  LinkedIn Account Not Connected
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Connect your LinkedIn profile or Company Page to access organization administration shortcuts.
                </p>
                <div className="pt-2">
                  <Link
                    href={`/app/${workspaceSlug}/social-accounts`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0A66C2] hover:bg-blue-700 rounded-xl shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Connect LinkedIn Account</span>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Account Operations Audit Trail */}
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
        <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          <span>Account Settings Audit Trail</span>
        </h3>

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-xs text-zinc-400 text-center py-4">
              No account changes recorded yet. All edits to operating hours, descriptions, and reviews are audited here.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
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
  );
}
