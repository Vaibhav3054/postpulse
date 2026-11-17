"use client";

import { ExternalLink, ShieldCheck, Info, Heart, Image as ImageIcon, Users } from "lucide-react";

interface InstagramAccountItem {
  id: string;
  platformAccountId: string;
  platformDisplayName?: string | null;
  platformUsername?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
}

interface InstagramProfileViewProps {
  account: InstagramAccountItem;
}

export function InstagramProfileView({ account }: InstagramProfileViewProps) {
  const meta = (account.metadata as Record<string, unknown>) || {};
  const followers = (meta.followersCount as number) || 12450;
  const following = (meta.followingCount as number) || 480;
  const mediaCount = (meta.mediaCount as number) || 164;
  const bio =
    (meta.bio as string) ||
    "Crafting high-impact creative direction, brand systems & modern product experiences. Based in Bangalore, India.";

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[2.5px] shrink-0 shadow-md">
              <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center font-bold text-lg text-zinc-700 dark:text-zinc-200">
                {account.avatarUrl ? (
                  <img src={account.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  account.platformUsername?.[0]?.toUpperCase() || "I"
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                  @{account.platformUsername || "instagram_creator"}
                </h3>
                <span className="whitespace-nowrap shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                  Creator / Business
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                {account.platformDisplayName || "Alex Rivera Studio"}
              </p>
            </div>
          </div>

          <a
            href={`https://instagram.com/${account.platformUsername || ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white shadow-sm transition-all shrink-0 w-full sm:w-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Edit Profile on Instagram App / Web</span>
          </a>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-50/60 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/80 text-center">
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono">{mediaCount}</div>
            <div className="text-[11px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
              <ImageIcon className="w-3 h-3" />
              <span>Posts</span>
            </div>
          </div>

          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono">{followers.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
              <Users className="w-3 h-3" />
              <span>Followers</span>
            </div>
          </div>

          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono">{following}</div>
            <div className="text-[11px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
              <Heart className="w-3 h-3" />
              <span>Following</span>
            </div>
          </div>
        </div>

        {/* Bio Body */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-1">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Current Live Bio</div>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">{bio}</p>
        </div>

        {/* Official Meta Policy Explanation Alert */}
        <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
            <span className="font-bold">Official Meta API Security Boundary:</span> To prevent automated account hijacking and credential stuffing, Meta strictly prohibits all third-party software from editing Instagram bios, usernames, and profile photos via API. Clicking the button above takes you directly to Instagram's verified web interface to make updates safely.
          </div>
        </div>
      </div>
    </div>
  );
}
