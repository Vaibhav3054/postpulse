"use client";

import { Check } from "lucide-react";
import { SocialPlatformType } from "@/lib/social-providers/types";

export interface ConnectedAccountItem {
  id: string;
  platform: SocialPlatformType;
  platformUsername: string;
  platformDisplayName: string;
  avatarUrl?: string;
}

interface AccountSelectorProps {
  accounts: ConnectedAccountItem[];
  selectedAccountIds: string[];
  onToggleAccount: (id: string) => void;
  onSelectAll: () => void;
}

export function AccountSelector({
  accounts,
  selectedAccountIds,
  onToggleAccount,
  onSelectAll,
}: AccountSelectorProps) {
  if (accounts.length === 0) {
    return (
      <div className="p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
        No social accounts connected to this workspace yet.
      </div>
    );
  }

  const getPlatformBadge = (platform: SocialPlatformType) => {
    switch (platform) {
      case "INSTAGRAM":
        return {
          bg: "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white",
          label: "Instagram",
        };
      case "FACEBOOK":
        return {
          bg: "bg-[#1877F2] text-white",
          label: "Facebook Page",
        };
      case "YOUTUBE":
        return {
          bg: "bg-[#FF0000] text-white",
          label: "YouTube",
        };
      case "LINKEDIN":
        return {
          bg: "bg-[#0A66C2] text-white",
          label: "LinkedIn",
        };
      case "GOOGLE_BUSINESS":
        return {
          bg: "bg-[#4285F4] text-white",
          label: "Google Business",
        };
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Select Target Channels</span>
        <button
          type="button"
          onClick={onSelectAll}
          className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          {selectedAccountIds.length === accounts.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {accounts.map((acc) => {
          const isSelected = selectedAccountIds.includes(acc.id);
          const badge = getPlatformBadge(acc.platform);

          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => onToggleAccount(acc.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-sm"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${badge.bg}`}
              >
                {acc.platform[0]}
              </div>
              <span className="truncate max-w-[140px]">{acc.platformDisplayName || acc.platformUsername}</span>
              {isSelected ? (
                <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-0.5" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
