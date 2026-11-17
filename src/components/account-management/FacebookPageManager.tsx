"use client";

import { useState } from "react";
import {
  Share2,
  Globe,
  Phone,
  Clock,
  Save,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface FacebookAccountItem {
  id: string;
  platformAccountId: string;
  platformDisplayName?: string | null;
  platformUsername?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
}

interface FacebookPageManagerProps {
  account: FacebookAccountItem;
  workspaceId: string;
}

export function FacebookPageManager({ account, workspaceId }: FacebookPageManagerProps) {
  const meta = (account.metadata as Record<string, unknown>) || {};
  const [about, setAbout] = useState((meta.about as string) || "Leading brand and creative studio specializing in high-impact campaigns.");
  const [phone, setPhone] = useState((meta.phone as string) || "+91 98450 12345");
  const [website, setWebsite] = useState((meta.website as string) || "https://postpulse.io");
  const [hours, setHours] = useState((meta.hours as string) || "Mon-Sat: 09:30 AM - 08:30 PM IST");

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/account-management/facebook", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          socialAccountId: account.id,
          about,
          phone,
          website,
          hours,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update Facebook Page settings");

      setToastMessage("Facebook Page details updated successfully!");
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500 text-white text-xs font-semibold shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-white/80 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Header Info */}
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-[#1877F2] text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              "F"
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                {account.platformDisplayName || "Facebook Brand Page"}
              </h3>
              <span className="whitespace-nowrap shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Connected Page
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 truncate">
              @{account.platformUsername || account.platformAccountId} • Meta Graph API Active
            </div>
          </div>
        </div>

        <a
          href={`https://facebook.com/${account.platformAccountId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors w-full sm:w-auto shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open on Facebook</span>
        </a>
      </div>

      {/* Editable Fields Form */}
      <form onSubmit={handleSave} className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
          Page Metadata & Contact Information
        </h4>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Page About & Overview Description
          </label>
          <textarea
            rows={3}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            className="w-full p-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Contact Phone (+91)
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Official Website
            </label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Business Hours Summary
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
              <input
                type="text"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Facebook Page Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
