"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Sparkles,
  Upload,
  ChevronDown,
  ChevronUp,
  Hash,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  PenSquare,
  Eye,
} from "lucide-react";
import { AccountSelector, ConnectedAccountItem } from "./AccountSelector";
import { LiveMockupPreview } from "./LiveMockupPreview";
import { SocialPlatformType } from "@/lib/social-providers/types";

interface MediaAssetItem {
  id: string;
  fileName: string;
  publicUrl: string;
  mediaType: "IMAGE" | "VIDEO";
}

interface ContentComposerProps {
  workspaceId: string;
  workspaceSlug: string;
  accounts: ConnectedAccountItem[];
  mediaLibrary: MediaAssetItem[];
}

export function ContentComposer({
  workspaceId,
  workspaceSlug,
  accounts,
  mediaLibrary,
}: ContentComposerProps) {
  const router = useRouter();

  // State
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    accounts.map((a) => a.id)
  );
  const [commonCaption, setCommonCaption] = useState("");
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [customCaptions, setCustomCaptions] = useState<Record<string, string>>({});
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubePrivacy, setYoutubePrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [expandedPlatformOverrides, setExpandedPlatformOverrides] = useState<Record<string, boolean>>({});

  // Scheduling state
  const [publishMode, setPublishMode] = useState<"NOW" | "SCHEDULE" | "DRAFT">("SCHEDULE");
  
  // Default scheduled time: tomorrow at 18:30
  const getDefaultScheduledDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const [scheduledDate, setScheduledDate] = useState(getDefaultScheduledDate());
  const [scheduledTime, setScheduledTime] = useState("19:00"); // 7:00 PM IST (Prime Indian Reels & Social time)
  const [timezone, setTimezone] = useState("Asia/Kolkata"); // Default India Standard Time
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");

  // Preview tab state
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialPlatformType>(
    accounts[0]?.platform || "INSTAGRAM"
  );

  // Status & modal states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));
  const availablePlatforms = Array.from(new Set(selectedAccounts.map((a) => a.platform)));

  // Ensure active preview platform stays in sync with selected channels
  if (availablePlatforms.length > 0 && !availablePlatforms.includes(activePreviewPlatform)) {
    setActivePreviewPlatform(availablePlatforms[0]);
  }

  const toggleAccount = (id: string) => {
    if (selectedAccountIds.includes(id)) {
      setSelectedAccountIds(selectedAccountIds.filter((item) => item !== id));
    } else {
      setSelectedAccountIds([...selectedAccountIds, id]);
    }
  };

  const selectAll = () => {
    if (selectedAccountIds.length === accounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(accounts.map((a) => a.id));
    }
  };

  const handleInsertHashtag = (tag: string) => {
    setCommonCaption((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    setQuotaError(null);

    try {
      // Step 1: Request upload URL
      const urlRes = await fetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          fileSizeBytes: file.size,
        }),
      });

      const urlData = await urlRes.json();
      if (!urlRes.ok) {
        throw new Error(urlData.error || "Failed to initiate upload");
      }

      // Step 2: Upload bytes
      if (urlData.isDirectUpload) {
        await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
      } else {
        await fetch(urlData.uploadUrl, {
          method: "PUT",
          body: await file.arrayBuffer(),
        });
      }

      // Step 3: Register media asset in database
      const saveRes = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          fileName: file.name,
          storageKey: urlData.storageKey,
          publicUrl: urlData.publicUrl,
          mimeType: file.type,
          fileSizeBytes: file.size,
        }),
      });
      const saveData = await saveRes.json();
      if (saveRes.ok && saveData.asset) {
        setSelectedMediaIds((prev) => [...prev, saveData.asset.id]);
        mediaLibrary.unshift(saveData.asset);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setQuotaError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAccountIds.length === 0) {
      alert("Please select at least one social media channel.");
      return;
    }

    setIsSubmitting(true);
    setQuotaError(null);

    try {
      let scheduledAt: Date | undefined;
      if (publishMode === "SCHEDULE") {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
      }

      const targets = selectedAccounts.map((acc) => {
        const customCap = customCaptions[acc.id];
        const isYT = acc.platform === "YOUTUBE";
        return {
          socialAccountId: acc.id,
          platform: acc.platform,
          customCaption: customCap?.trim() ? customCap : undefined,
          platformPayload: isYT
            ? {
                title: youtubeTitle.trim() || commonCaption.substring(0, 80) || "Video Title",
                privacyStatus: youtubePrivacy,
              }
            : {},
        };
      });

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          status: publishMode === "NOW" ? "PUBLISHED" : publishMode === "SCHEDULE" ? "SCHEDULED" : "DRAFT",
          commonCaption,
          scheduledAt: scheduledAt?.toISOString(),
          timezone,
          mediaAssetIds: selectedMediaIds,
          targets,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create post");
      }

      setSuccessToast(
        publishMode === "NOW"
          ? "Post published successfully!"
          : publishMode === "SCHEDULE"
          ? "Post scheduled successfully!"
          : "Draft saved!"
      );

      setTimeout(() => {
        router.push(`/app/${workspaceSlug}/posts`);
        router.refresh();
      }, 1200);
    } catch (err: unknown) {
      const error = err as Error;
      setQuotaError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMediaAssets = mediaLibrary.filter((m) => selectedMediaIds.includes(m.id));
  const activeAccount = selectedAccounts.find((a) => a.platform === activePreviewPlatform);
  const activeCustomCaption = activeAccount ? customCaptions[activeAccount.id] : undefined;
  const previewCaption = activeCustomCaption || commonCaption;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden bg-white dark:bg-zinc-950">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 p-3 bg-emerald-600 text-white rounded-xl shadow-xl text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Quota Error Modal */}
      {quotaError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm mb-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Subscription Limit Reached</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">{quotaError}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuotaError(null)}
                className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                Dismiss
              </button>
              <a
                href={`/app/${workspaceSlug}/settings`}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                Upgrade Plan
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher (Phone-optimized toggle) */}
      <div className="lg:hidden flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-2 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab("editor")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "editor"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <PenSquare className="w-3.5 h-3.5" />
          <span>Write Post</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "preview"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Live Mockup Preview</span>
        </button>
      </div>

      {/* LEFT PANE: Editor & Customization Controls */}
      <div
        className={`w-full lg:w-3/5 h-full overflow-y-auto p-4 sm:p-6 border-r border-zinc-200 dark:border-zinc-800 space-y-6 ${
          mobileTab === "editor" ? "block" : "hidden lg:block"
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target Accounts Selection */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <AccountSelector
              accounts={accounts}
              selectedAccountIds={selectedAccountIds}
              onToggleAccount={toggleAccount}
              onSelectAll={selectAll}
            />
          </div>

          {/* Master Caption Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                Master Caption
              </label>
              <div className="flex items-center gap-1.5">
                {["#SaaS", "#Productivity", "#Creator", "#Tech"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInsertHashtag(tag)}
                    className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={5}
              required
              value={commonCaption}
              onChange={(e) => setCommonCaption(e.target.value)}
              placeholder="What would you like to share across your channels? Write once, customize anywhere..."
              className="w-full p-3.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white leading-relaxed resize-none"
            />
          </div>

          {/* Media Attachments Dropzone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                Media Attachments
              </span>
              <span className="text-zinc-500">Supports JPG, PNG, MP4</span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {/* Selected Media Chips */}
              {selectedMediaAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="relative aspect-square rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden group bg-zinc-100 dark:bg-zinc-900"
                >
                  <img src={asset.publicUrl} alt={asset.fileName} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setSelectedMediaIds(selectedMediaIds.filter((id) => id !== asset.id))}
                    className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Upload Drop Button */}
              <label className="aspect-square rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 flex flex-col items-center justify-center cursor-pointer transition-colors text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-zinc-50/50 dark:bg-zinc-900/30">
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-[11px] font-medium text-center px-1">
                  {isUploading ? "Uploading..." : "Upload Media"}
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Platform Specific Customization Overrides */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>Channel Customizations & Overrides</span>
              <span className="text-[11px] text-zinc-500 font-normal">Optional</span>
            </div>

            {selectedAccounts.map((acc) => {
              const isExpanded = expandedPlatformOverrides[acc.id] || false;
              const isYT = acc.platform === "YOUTUBE";

              return (
                <div
                  key={acc.id}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPlatformOverrides((prev) => ({
                        ...prev,
                        [acc.id]: !isExpanded,
                      }))
                    }
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-zinc-900 dark:text-white">
                        {acc.platformDisplayName || acc.platformUsername}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase font-mono">
                        ({acc.platform})
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/30">
                      {isYT && (
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                            YouTube Video Title
                          </label>
                          <input
                            type="text"
                            placeholder="Enter a compelling video title (max 100 characters)"
                            value={youtubeTitle}
                            onChange={(e) => setYoutubeTitle(e.target.value)}
                            maxLength={100}
                            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-white"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                          Custom Caption Override
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Override the master caption for this specific network..."
                          value={customCaptions[acc.id] || ""}
                          onChange={(e) =>
                            setCustomCaptions({
                              ...customCaptions,
                              [acc.id]: e.target.value,
                            })
                          }
                          className="w-full p-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-white resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Publishing & Scheduling Controls */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPublishMode("SCHEDULE")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  publishMode === "SCHEDULE"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Schedule for Future
              </button>
              <button
                type="button"
                onClick={() => setPublishMode("NOW")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  publishMode === "NOW"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 shadow-sm"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Publish Immediately
              </button>
              <button
                type="button"
                onClick={() => setPublishMode("DRAFT")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  publishMode === "DRAFT"
                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Save Draft
              </button>
            </div>

            {publishMode === "SCHEDULE" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Date
                  </label>
                  <div className="flex items-center px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 mr-2" />
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="bg-transparent focus:outline-none text-zinc-900 dark:text-white w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Time
                  </label>
                  <div className="flex items-center px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 mr-2" />
                    <input
                      type="time"
                      required
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="bg-transparent focus:outline-none text-zinc-900 dark:text-white w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none text-zinc-900 dark:text-white"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>

                {/* Indian Audience Peak Engagement Presets */}
                <div className="sm:col-span-3 pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      ⚡ Indian Audience Peak Engagement Presets:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "🌅 09:30 AM (LinkedIn/Morning)", time: "09:30" },
                      { label: "☀️ 01:30 PM (Lunch Shorts)", time: "13:30" },
                      { label: "🌆 07:00 PM (Prime Reels)", time: "19:00" },
                      { label: "🌙 09:00 PM (YouTube Night)", time: "21:00" },
                    ].map((preset) => (
                      <button
                        key={preset.time}
                        type="button"
                        onClick={() => {
                          setScheduledTime(preset.time);
                          setTimezone("Asia/Kolkata");
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                          scheduledTime === preset.time && timezone === "Asia/Kolkata"
                            ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-sm"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-400"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => router.push(`/app/${workspaceSlug}/posts`)}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !commonCaption.trim()}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                "Processing..."
              ) : publishMode === "NOW" ? (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish to {selectedAccounts.length} Channels Now</span>
                </>
              ) : publishMode === "SCHEDULE" ? (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Content</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT PANE: Live Interactive Mockup Previews */}
      <div
        className={`w-full lg:w-2/5 h-full p-4 sm:p-6 bg-zinc-50/50 dark:bg-zinc-950/30 overflow-y-auto ${
          mobileTab === "preview" ? "block" : "hidden lg:block"
        }`}
      >
        <LiveMockupPreview
          platform={activePreviewPlatform}
          availablePlatforms={availablePlatforms}
          onSelectPlatform={setActivePreviewPlatform}
          caption={previewCaption}
          mediaUrls={selectedMediaAssets.map((m) => m.publicUrl)}
          accountName={activeAccount?.platformDisplayName || "Alex Rivera"}
          accountUsername={activeAccount?.platformUsername || "alexrivera_official"}
          accountAvatar={activeAccount?.avatarUrl}
          youtubeTitle={youtubeTitle}
        />
      </div>
    </div>
  );
}
