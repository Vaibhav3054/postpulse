"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { SocialPlatformType } from "@/lib/social-providers/types";

interface SocialAccountItem {
  id: string;
  platform: SocialPlatformType;
  platformAccountId: string;
  platformUsername?: string;
  platformDisplayName?: string;
  avatarUrl?: string;
  tokenExpiresAt?: string;
  metadata?: Record<string, unknown>;
  isActive: boolean;
}

interface SocialAccountsManagerProps {
  accounts: SocialAccountItem[];
  workspaceId: string;
  workspaceSlug: string;
  maxSocialAccounts?: number;
}

export function SocialAccountsManager({
  accounts: initialAccounts,
  workspaceId,
  workspaceSlug,
  maxSocialAccounts = 6,
}: SocialAccountsManagerProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccountItem[]>(initialAccounts);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const platformsConfig = [
    {
      platform: "INSTAGRAM" as const,
      name: "Instagram Professional",
      tagline: "Publish Photos, Reels & Stories to Creator / Business accounts",
      badgeColor: "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white",
      officialApi: "Meta Graph API v20.0 (Instagram Content Publish)",
      prereq: "Account must be an Instagram Professional account linked to a Facebook Page.",
    },
    {
      platform: "FACEBOOK" as const,
      name: "Facebook Pages",
      tagline: "Post updates, photos, and native videos to your brand pages",
      badgeColor: "bg-[#1877F2] text-white",
      officialApi: "Meta Pages API (pages_manage_posts)",
      prereq: "Must have Admin or Editor role on the target Facebook Page.",
    },
    {
      platform: "YOUTUBE" as const,
      name: "YouTube Channel",
      tagline: "Schedule and publish full-length videos and Shorts directly",
      badgeColor: "bg-[#FF0000] text-white",
      officialApi: "Google YouTube Data API v3",
      prereq: "Active YouTube channel associated with your Google Account.",
    },
    {
      platform: "LINKEDIN" as const,
      name: "LinkedIn Profile & Pages",
      tagline: "Share executive articles, company updates, and media",
      badgeColor: "bg-[#0A66C2] text-white",
      officialApi: "LinkedIn Community Management / Share API",
      prereq: "Personal LinkedIn account or Company Page admin privileges.",
    },
    {
      platform: "GOOGLE_BUSINESS" as const,
      name: "Google Business Profile",
      tagline: "Publish local updates, offers & photo posts to Google Maps & Search",
      badgeColor: "bg-[#4285F4] text-white",
      officialApi: "Google My Business & Local Posts API v4",
      prereq: "Verified Google Business Profile. Ideal for Indian clinics, restaurants & retail shops.",
    },
  ];

  const handleConnect = async (platform: SocialPlatformType) => {
    setConnectingPlatform(platform);
    setError(null);
    try {
      const res = await fetch("/api/social-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          platform,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect account");
      }

      setAccounts((prev) => [data.account, ...prev]);
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this social account?")) return;
    try {
      await fetch(`/api/social-accounts/${accountId}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Overview & Security Banner */}
      <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-500" />
            <span>Connected Social Accounts ({accounts.length}/{maxSocialAccounts})</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">
            All integrations use official OAuth 2.0 flows. Access tokens are encrypted with AES-256-GCM at rest and are never sent to the browser.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold self-start md:self-auto">
          <ShieldCheck className="w-4 h-4" />
          <span>AES-256 Token Vault Active</span>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of 4 Platforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platformsConfig.map((p) => {
          const connectedForPlatform = accounts.filter((a) => a.platform === p.platform);

          return (
            <div
              key={p.platform}
              className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${p.badgeColor}`}
                  >
                    {p.platform[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {p.name}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-1">{p.tagline}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleConnect(p.platform)}
                  disabled={connectingPlatform === p.platform}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors shrink-0"
                >
                  {connectingPlatform === p.platform ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Connect</span>
                </button>
              </div>

              {/* Connected accounts for this platform */}
              {connectedForPlatform.length > 0 ? (
                <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  {connectedForPlatform.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-3 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0">
                          {acc.avatarUrl ? (
                            <img src={acc.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="flex items-center justify-center h-full text-xs font-bold text-zinc-500">
                              {acc.platform[0]}
                            </span>
                          )}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                            {acc.platformDisplayName || acc.platformUsername}
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate">
                            @{acc.platformUsername || acc.platformAccountId}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                        <button
                          onClick={() => handleDisconnect(acc.id)}
                          title="Disconnect account"
                          className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                  Not connected yet in this workspace.
                </div>
              )}

              <p className="text-[11px] text-zinc-400 leading-normal border-t border-zinc-100 dark:border-zinc-800/50 pt-2">
                <span className="font-semibold text-zinc-500">Requirement:</span> {p.prereq}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
