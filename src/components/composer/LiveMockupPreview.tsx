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
  MapPin,
  Star,
  Phone,
  Calendar,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
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
  googleActionType?: "LEARN_MORE" | "CALL" | "BOOK" | "ORDER" | "SHOP" | "SIGN_UP";
  googleActionUrl?: string;
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
  googleActionType = "LEARN_MORE",
  googleActionUrl,
}: LiveMockupPreviewProps) {
  const displayCaption = caption || "Your post preview will appear here in real time as you compose...";
  const hasMedia = mediaUrls.length > 0;
  const primaryMedia = mediaUrls[0];

  const characterLimits: Record<SocialPlatformType, number> = {
    INSTAGRAM: 2200,
    FACEBOOK: 63206,
    YOUTUBE: 5000,
    LINKEDIN: 3000,
    GOOGLE_BUSINESS: 1500,
  };

  const limit = characterLimits[platform] || 2200;
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
                className={`px-3 py-1 rounded-md text-xs font-semibold tracking-tight transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {p === "INSTAGRAM" && "Instagram"}
                {p === "FACEBOOK" && "Facebook"}
                {p === "YOUTUBE" && "YouTube"}
                {p === "LINKEDIN" && "LinkedIn"}
                {p === "GOOGLE_BUSINESS" && "Google Business"}
              </button>
            );
          })}
        </div>

        {/* Character Counter Badge */}
        <div
          className={`text-[11px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
            isOverLimit
              ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800"
              : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
          }`}
        >
          {charCount} / {limit}
        </div>
      </div>

      {/* Mockup Card Container */}
      <div className="flex-1 p-4 sm:p-6 pb-12 sm:pb-8 overflow-y-auto flex flex-col items-center justify-start min-h-0">
        {/* INSTAGRAM MOCKUP */}
        {platform === "INSTAGRAM" && (
          <div className="w-full max-w-sm my-auto bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs shrink-0 mb-6">
            {/* Header */}
            <div className="p-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[2px]">
                  <div className="w-full h-full rounded-full bg-white dark:bg-black overflow-hidden flex items-center justify-center font-bold text-[10px]">
                    {accountAvatar ? (
                      <img src={accountAvatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      accountUsername[0]?.toUpperCase() || "I"
                    )}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white leading-tight">
                    {accountUsername}
                  </div>
                  <div className="text-[10px] text-zinc-400">Original audio</div>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-zinc-400" />
            </div>

            {/* Media Container */}
            <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
              {hasMedia ? (
                <img src={primaryMedia} alt="Media" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4 text-zinc-400">
                  <span className="text-2xl">📸</span>
                  <p className="mt-1 text-[11px]">Attach photo/video to preview</p>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-zinc-800 dark:text-zinc-200 cursor-pointer" />
                  <MessageCircle className="w-5 h-5 text-zinc-800 dark:text-zinc-200 cursor-pointer" />
                  <Send className="w-5 h-5 text-zinc-800 dark:text-zinc-200 cursor-pointer" />
                </div>
                <Bookmark className="w-5 h-5 text-zinc-800 dark:text-zinc-200 cursor-pointer" />
              </div>

              {/* Likes & Caption */}
              <div className="font-semibold text-zinc-900 dark:text-white">1,248 likes</div>
              <div className="text-zinc-800 dark:text-zinc-200 leading-snug">
                <span className="font-semibold text-zinc-900 dark:text-white mr-1.5">
                  {accountUsername}
                </span>
                <span className="whitespace-pre-wrap">{displayCaption}</span>
              </div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider pt-1">
                2 hours ago • Verified
              </div>
            </div>
          </div>
        )}

        {/* FACEBOOK MOCKUP */}
        {platform === "FACEBOOK" && (
          <div className="w-full max-w-sm my-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs shrink-0 mb-6">
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#1877F2] text-white font-bold flex items-center justify-center shrink-0 overflow-hidden">
                  {accountAvatar ? (
                    <img src={accountAvatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    "F"
                  )}
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white text-xs">
                    {accountName}
                  </div>
                  <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <span>Just now</span>
                    <span>•</span>
                    <Globe className="w-2.5 h-2.5" />
                  </div>
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

            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-around text-zinc-500 font-semibold text-[11px]">
              <button type="button" className="flex items-center gap-1.5 py-1 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <ThumbsUp className="w-4 h-4 text-[#1877F2]" />
                <span>Like</span>
              </button>
              <button type="button" className="flex items-center gap-1.5 py-1 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <MessageCircle className="w-4 h-4" />
                <span>Comment</span>
              </button>
              <button type="button" className="flex items-center gap-1.5 py-1 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </div>
        )}

        {/* YOUTUBE MOCKUP */}
        {platform === "YOUTUBE" && (
          <div className="w-full max-w-sm my-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs shrink-0 mb-6">
            <div className="relative aspect-video bg-zinc-900 flex items-center justify-center">
              {hasMedia ? (
                <img src={primaryMedia} alt="Media" className="w-full h-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              )}
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                03:45
              </span>
            </div>

            <div className="p-3 space-y-2">
              <div className="font-bold text-zinc-900 dark:text-white text-sm line-clamp-2">
                {youtubeTitle || "Video Title Preview"}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="w-7 h-7 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-[10px]">
                  {accountAvatar ? (
                    <img src={accountAvatar} alt="avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    "YT"
                  )}
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white text-xs">
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
          <div className="w-full max-w-sm my-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs shrink-0 mb-6">
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

        {/* GOOGLE BUSINESS PROFILE MOCKUP (Google Maps & Search Update) */}
        {platform === "GOOGLE_BUSINESS" && (
          <div className="w-full max-w-sm my-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden text-xs shrink-0 mb-6">
            {/* Google Search / Maps Header */}
            <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#4285F4] font-bold flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  {accountAvatar ? (
                    <img src={accountAvatar} alt="Business Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-extrabold text-[#4285F4]">G</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white text-xs truncate">
                    <span>{accountName || "Your Business Name"}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#4285F4] shrink-0" />
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold mt-0.5">
                    <span>4.9</span>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-normal">(384 on Google)</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-[#EA4335]" />
                    <span>Posted on Google Maps & Search • Today</span>
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                Update
              </span>
            </div>

            {/* Media Banner */}
            {hasMedia && (
              <div className="w-full aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative">
                <img src={primaryMedia} alt="Media" className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-white text-[10px] font-medium flex items-center gap-1">
                  <span>Google Photos</span>
                </div>
              </div>
            )}

            {/* Announcement / Post Body */}
            <div className="p-3.5 space-y-3">
              <div className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed text-xs">
                {displayCaption}
              </div>

              {/* Call to Action Button */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <button
                  type="button"
                  className="px-4 py-2 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5"
                >
                  {googleActionType === "CALL" && <Phone className="w-3.5 h-3.5" />}
                  {googleActionType === "BOOK" && <Calendar className="w-3.5 h-3.5" />}
                  {googleActionType === "ORDER" && <ShoppingBag className="w-3.5 h-3.5" />}
                  {googleActionType === "SHOP" && <ShoppingBag className="w-3.5 h-3.5" />}
                  {googleActionType === "SIGN_UP" && <ExternalLink className="w-3.5 h-3.5" />}
                  {(!googleActionType || googleActionType === "LEARN_MORE") && <Globe className="w-3.5 h-3.5" />}

                  <span>
                    {googleActionType === "CALL" && "Call Now"}
                    {googleActionType === "BOOK" && "Book Appointment"}
                    {googleActionType === "ORDER" && "Order Online"}
                    {googleActionType === "SHOP" && "Shop Now"}
                    {googleActionType === "SIGN_UP" && "Sign Up"}
                    {(!googleActionType || googleActionType === "LEARN_MORE") && "Learn More"}
                  </span>
                </button>

                <div className="text-[10px] text-zinc-400">
                  {googleActionType === "CALL" ? "Direct Dial Phone" : googleActionUrl ? "Website link" : "Official Action"}
                </div>
              </div>
            </div>

            {/* Bottom Google Trust Badge */}
            <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950/60 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[#4285F4]">G</span>
                <span>Verified Business Knowledge Panel</span>
              </div>
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">Local SEO Active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
