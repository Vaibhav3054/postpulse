"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  ShieldCheck,
  RefreshCw,
  FlaskConical,
  KeyRound,
  Clock,
} from "lucide-react";
import { SocialPlatformType } from "@/lib/social-providers/types";
import type { ProviderIntegrationStatus } from "@/lib/social-providers/oauth-service";
import type { PlatformAvailability } from "@/lib/platform-flags";

interface SocialAccountItem {
  id: string;
  platform: SocialPlatformType;
  platformAccountId: string;
  platformUsername?: string;
  platformDisplayName?: string;
  avatarUrl?: string;
  tokenExpiresAt?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  isActive: boolean;
}

interface SocialAccountsManagerProps {
  accounts: SocialAccountItem[];
  workspaceId: string;
  workspaceSlug: string;
  maxSocialAccounts?: number;
  providerStatuses?: Record<SocialPlatformType, ProviderIntegrationStatus>;
  platformAvailability?: Record<SocialPlatformType, PlatformAvailability>;
}

export function SocialAccountsManager({
  accounts: initialAccounts,
  workspaceId,
  maxSocialAccounts = 6,
  providerStatuses,
  platformAvailability,
}: SocialAccountsManagerProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccountItem[]>(initialAccounts);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [verifyingAccountId, setVerifyingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const platformsConfig = [
    {
      platform: "GOOGLE_BUSINESS" as const,
      name: "Google Business Profile",
      tagline: "Publish local updates, offers & photo posts to Google Maps & Search",
      badgeColor: "bg-[#4285F4] text-white",
      officialApi: "Google Business Profile & Local Posts API",
      prereq: "Verified Google Business Profile. Ideal for local clinics, restaurants & retail shops.",
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
      platform: "INSTAGRAM" as const,
      name: "Instagram Professional",
      tagline: "Publish Photos, Reels & Stories to Creator / Business accounts",
      badgeColor: "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white",
      officialApi: "Meta Graph API v20.0 (Instagram Content Publish)",
      prereq: "Account must be an Instagram Professional account linked to a Facebook Page.",
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
      platform: "YOUTUBE" as const,
      name: "YouTube Channel",
      tagline: "Schedule and publish full-length videos and Shorts directly",
      badgeColor: "bg-[#FF0000] text-white",
      officialApi: "Google YouTube Data API v3",
      prereq: "Active YouTube channel associated with your Google Account.",
    },
  ];

  const anyLiveProvider = providerStatuses
    ? Object.values(providerStatuses).some((s) => s.mode === "live")
    : false;

  const handleConnect = async (platform: SocialPlatformType) => {
    setConnectingPlatform(platform);
    setError(null);
    setNotice(null);

    try {
      const startRes = await fetch(
        `/api/social-accounts/oauth/start?workspaceId=${encodeURIComponent(
          workspaceId
        )}&platform=${encodeURIComponent(platform)}`
      );
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok) {
        throw new Error(startData.error || "Failed to start OAuth connection");
      }

      if (startData.mode === "live" && startData.authUrl) {
        window.location.href = startData.authUrl;
        return;
      }

      // Sandbox / Mock Mode: explicitly connect a sandbox test account
      const res = await fetch("/api/social-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          platform,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect sandbox account");
      }

      setAccounts((prev) => [data.account, ...prev]);
      setNotice(
        `Connected a Sandbox Test Account for ${platform.replace("_", " ")}. Configure live API credentials in Netlify/env before connecting real external accounts.`
      );
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleVerifyAccount = async (accountId: string) => {
    setVerifyingAccountId(accountId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/social-accounts/${accountId}/verify`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setNotice(data.message || "Connection verified.");
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? {
                ...a,
                tokenExpiresAt: data.tokenExpiresAt || a.tokenExpiresAt,
                metadata: {
                  ...(a.metadata || {}),
                  needsReauth: Boolean(data.needsReauth),
                  connectionMode: data.mode,
                  isMock: data.mode === "mock_sandbox",
                },
              }
            : a
        )
      );
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setVerifyingAccountId(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this social account?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/social-accounts/${accountId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to disconnect account.");
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      router.refresh();
    } catch {
      setError("Network error while disconnecting account.");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Overview & Security Banner */}
      <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-500" />
            <span>
              Connected Social Accounts ({accounts.length}/{maxSocialAccounts})
            </span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">
            Official OAuth 2.0 flows with server-side CSRF state protection. Access and refresh tokens are encrypted with AES-256-GCM at rest and are never exposed to the browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {anyLiveProvider ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Live OAuth Vault Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
              <FlaskConical className="w-4 h-4" />
              <span>Sandbox Mode (Awaiting Live API Keys)</span>
            </div>
          )}
        </div>
      </div>

      {!anyLiveProvider && (
        <div className="p-3.5 text-xs bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-0.5">
            <p className="font-semibold">Sandbox / Mock Integration Mode Active</p>
            <p className="text-[11px] opacity-90">
              Third-party developer API keys (Google, Meta, LinkedIn) are not configured yet. Accounts connected right now are simulated sandbox accounts for testing workflows and do not publish to live external social profiles.
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div className="p-3 text-xs bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg flex items-center gap-2">
          <KeyRound className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Platforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platformsConfig.map((p) => {
          const connectedForPlatform = accounts.filter((a) => a.platform === p.platform);
          const status = providerStatuses?.[p.platform];
          const isLive = status?.mode === "live";
          const avail = platformAvailability?.[p.platform];
          const isComingSoon = avail?.isComingSoon === true;
          const canConnect = avail ? avail.canConnect : true;
          const isAdminBypass = avail?.adminPreviewBypass === true;

          return (
            <div
              key={p.platform}
              className={`p-5 rounded-xl border shadow-sm space-y-4 transition-opacity ${
                isComingSoon && !canConnect
                  ? "border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/60 opacity-90"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${p.badgeColor} ${
                      isComingSoon && !canConnect ? "opacity-75" : ""
                    }`}
                  >
                    {p.platform[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {p.name}
                      </h3>
                      {isComingSoon && !canConnect ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70">
                          Coming Soon
                        </span>
                      ) : (
                        <>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              isLive
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                                : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {isLive ? "Live OAuth" : "Sandbox"}
                          </span>
                          {isAdminBypass && (
                            <span
                              title="Disabled for public users (shows Coming Soon). Enabled for you via Super Admin Bypass."
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                            >
                              Coming Soon · Admin Preview
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-1">{p.tagline}</p>
                  </div>
                </div>

                {isComingSoon && !canConnect ? (
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700/80 cursor-not-allowed shrink-0"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Coming Soon</span>
                  </button>
                ) : (
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
                    <span>{isLive ? "Connect" : "Connect Sandbox"}</span>
                  </button>
                )}
              </div>

              {/* Connected accounts for this platform */}
              {connectedForPlatform.length > 0 ? (
                <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  {connectedForPlatform.map((acc) => {
                    const meta = acc.metadata || {};
                    const isMockAcc = meta.isMock === true || !isLive;
                    const needsReauth = meta.needsReauth === true;
                    const isExpired =
                      acc.tokenExpiresAt && new Date(acc.tokenExpiresAt).getTime() <= Date.now();

                    return (
                      <div
                        key={acc.id}
                        className="p-3 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0">
                            {acc.avatarUrl ? (
                              <img
                                src={acc.avatarUrl}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="flex items-center justify-center h-full text-xs font-bold text-zinc-500">
                                {acc.platform[0]}
                              </span>
                            )}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                              <span className="truncate">
                                {acc.platformDisplayName || acc.platformUsername}
                              </span>
                              {isMockAcc && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
                                  Mock
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate">
                              @{acc.platformUsername || acc.platformAccountId}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {needsReauth || isExpired ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Reauth Needed</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isMockAcc ? "Sandbox" : "Live"}</span>
                            </span>
                          )}
                          <button
                            onClick={() => handleVerifyAccount(acc.id)}
                            disabled={verifyingAccountId === acc.id}
                            title="Verify connection & token health"
                            className="p-1 text-zinc-400 hover:text-indigo-500 transition-colors"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${
                                verifyingAccountId === acc.id ? "animate-spin" : ""
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => handleDisconnect(acc.id)}
                            title="Disconnect account"
                            className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                  Not connected yet in this workspace.
                </div>
              )}

              <p className="text-[11px] text-zinc-400 leading-normal border-t border-zinc-100 dark:border-zinc-800/50 pt-2">
                <span className="font-semibold text-zinc-500">Official API:</span> {p.officialApi} — {p.prereq}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
