"use client";

import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ThumbsUp,
  Share2,
  MoreHorizontal,
  Play,
  Globe,
  Repeat2,
} from "lucide-react";
import { SocialPlatformType } from "@/lib/social-providers/types";

interface LiveMockupPreviewProps {
  platform: SocialPlatformType;
  availablePlatforms: SocialPlatformType[];
  onSelectPlatform: (platform: SocialPlatformType) => void;
  caption: string;
  mediaUrls: string[];
  accountName?: string;
  accountUsername?: string;
  accountAvatar?: string;
  youtubeTitle?: string;
}

export function LiveMockupPreview({
  platform,
  availablePlatforms,
  onSelectPlatform,
  caption,
  mediaUrls,
  accountName = "Alex Rivera",
  accountUsername = "alexrivera_official",
  accountAvatar,
  youtubeTitle = "Mastering SaaS Architecture",
}: LiveMockupPreviewProps) {
  const displayCaption = caption || "Your post preview will appear here in real time as you compose...";
  const hasMedia = mediaUrls.length > 0;
  const primaryMedia = mediaUrls[0];

  const characterLimits: Record<SocialPlatformType, number> = {
    INSTAGRAM: 2200,
    FACEBOOK: 63206,
    YOUTUBE: 5000,
    LINKEDIN: 3000,
  };

  const limit = characterLimits[platform];
  const charCount = caption.length;
  const isOverLimit = charCount > limit;

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      {/* Platform Switcher Bar */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {availablePlatforms.map((p) => {
            const isActive = p === platform;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onSelectPlatform(p)}
                className={`px-3 py-1 rounded-md text-xs font-semibold tracking-tight transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {p === "INSTAGRAM" && "Instagram"}
                {p === "FACEBOOK" && "Facebook"}
                {p === "YOUTUBE" && "YouTube"}
                {p === "LINKEDIN" && "LinkedIn"}
              </button>
            );
          })}
        </div>

        {/* Character Counter Badge */}
        <div
          className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
            isOverLimit
              ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800"
              : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
          }`}
        >
          {charCount} / {limit}
        </div>
      </div>

      {/* Mockup Card Container */}
      <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
        {/* INSTAGRAM MOCKUP */}
        {platform === "INSTAGRAM" && (
          <div className="w-full max-w-sm bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs">
            {/* Header */}
            <div className="p-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                  <div className="w-full h-full rounded-full bg-white dark:bg-black overflow-hidden flex items-center justify-center">
                    {accountAvatar ? (
                      <img src={accountAvatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-[10px]">IG</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white leading-tight">
                    {accountUsername}
                  </div>
                  <div className="text-[10px] text-zinc-400">Sponsored • Original Audio</div>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-zinc-400" />
            </div>

            {/* Media Canvas */}
            <div className="w-full aspect-square bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center relative overflow-hidden">
              {hasMedia ? (
                <img src={primaryMedia} alt="Post preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6 text-zinc-400">
                  <p className="text-xs font-medium">No Image or Video Selected</p>
                  <p className="text-[11px] mt-1 text-zinc-500">Instagram posts require at least one photo or video</p>
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between text-zinc-900 dark:text-white">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 hover:text-rose-500 cursor-pointer" />
                  <MessageCircle className="w-5 h-5 cursor-pointer" />
                  <Send className="w-5 h-5 cursor-pointer" />
                </div>
                <Bookmark className="w-5 h-5 cursor-pointer" />
              </div>

              <div className="font-semibold text-zinc-900 dark:text-white text-[11px]">
                1,248 likes
              </div>

              {/* Caption */}
              <div className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed text-xs">
                <span className="font-semibold mr-1.5 text-zinc-900 dark:text-white">
                  {accountUsername}
                </span>
                {displayCaption}
              </div>

              <div className="text-[10px] uppercase text-zinc-400 tracking-wider">
                Just now
              </div>
            </div>
          </div>
        )}

        {/* FACEBOOK MOCKUP */}
        {platform === "FACEBOOK" && (
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs">
            <div className="p-3.5 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden">
                {accountAvatar ? (
                  <img src={accountAvatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  "FB"
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-zinc-900 dark:text-white text-xs">
                  {accountName}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <span>Just now</span>
                  <span>•</span>
                  <Globe className="w-3 h-3" />
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-zinc-400" />
            </div>

            <div className="px-3.5 pb-3 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed text-xs">
              {displayCaption}
            </div>

            {hasMedia && (
              <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <img src={primaryMedia} alt="Media" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-around text-zinc-500 font-medium">
              <button type="button" className="flex items-center gap-1.5 py-1 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Like</span>
              </button>
              <button type="button" className="flex items-center gap-1.5 py-1 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Comment</span>
              </button>
              <button type="button" className="flex items-center gap-1.5 py-1 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        )}

        {/* YOUTUBE MOCKUP */}
        {platform === "YOUTUBE" && (
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs">
            {/* Video Player Card */}
            <div className="w-full aspect-video bg-black relative flex items-center justify-center overflow-hidden">
              {hasMedia ? (
                <img src={primaryMedia} alt="thumbnail" className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="text-zinc-500 text-center">Video player preview</div>
              )}
              <div className="absolute w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                <Play className="w-5 h-5 fill-white ml-0.5" />
              </div>
            </div>

            <div className="p-3.5 space-y-2">
              <h4 className="font-semibold text-zinc-900 dark:text-white text-sm line-clamp-2">
                {youtubeTitle || caption.substring(0, 70) || "Video Title"}
              </h4>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  YT
                </div>
                <div className="truncate">
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {accountName}
                  </div>
                  <div className="text-[10px] text-zinc-400">45.2K subscribers</div>
                </div>
              </div>
              <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 text-[11px] whitespace-pre-wrap line-clamp-3">
                {displayCaption}
              </div>
            </div>
          </div>
        )}

        {/* LINKEDIN MOCKUP */}
        {platform === "LINKEDIN" && (
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs">
            <div className="p-3.5 flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-full bg-[#0A66C2] text-white font-bold flex items-center justify-center shrink-0 overflow-hidden">
                {accountAvatar ? (
                  <img src={accountAvatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  "LI"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-zinc-900 dark:text-white text-xs truncate">
                  {accountName}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  Founder & Creative Technologist • 1st
                </div>
                <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                  <span>Now</span>
                  <span>•</span>
                  <Globe className="w-2.5 h-2.5" />
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-zinc-400" />
            </div>

            <div className="px-3.5 pb-3 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed text-xs">
              {displayCaption}
            </div>

            {hasMedia && (
              <div className="w-full aspect-[4/3] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <img src={primaryMedia} alt="Media" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-around text-zinc-600 dark:text-zinc-400 font-semibold text-[11px]">
              <button type="button" className="flex items-center gap-1 py-1 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <ThumbsUp className="w-3.5 h-3.5 text-[#0A66C2]" />
                <span>Like</span>
              </button>
              <button type="button" className="flex items-center gap-1 py-1 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Comment</span>
              </button>
              <button type="button" className="flex items-center gap-1 py-1 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <Repeat2 className="w-3.5 h-3.5" />
                <span>Repost</span>
              </button>
              <button type="button" className="flex items-center gap-1 py-1 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
