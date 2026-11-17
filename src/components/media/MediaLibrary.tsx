"use client";

import { useState } from "react";
import { Upload, Trash2, Image as ImageIcon, Video, HardDrive, AlertCircle } from "lucide-react";

interface MediaAsset {
  id: string;
  fileName: string;
  publicUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  mimeType: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
  createdAt: string;
}

interface MediaLibraryProps {
  initialMedia: MediaAsset[];
  workspaceId: string;
  maxStorageMb?: number;
}

export function MediaLibrary({ initialMedia, workspaceId, maxStorageMb = 2048 }: MediaLibraryProps) {
  const [media, setMedia] = useState<MediaAsset[]>(initialMedia);
  const [filterType, setFilterType] = useState<"ALL" | "IMAGE" | "VIDEO">("ALL");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalBytes = media.reduce((acc, m) => acc + (m.fileSizeBytes || 0), 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
  const usagePercent = Math.min(100, Math.round((Number(totalMb) / maxStorageMb) * 100));

  const filteredMedia = media.filter((m) => {
    if (filterType === "ALL") return true;
    return m.mediaType === filterType;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const mimeType = file.type || "image/jpeg";
    const isVideo = mimeType.startsWith("video/");
    const maxBytes = isVideo ? 100 * 1024 * 1024 : 15 * 1024 * 1024;

    if (file.size > maxBytes) {
      setError(
        `File is too large. Maximum allowed size is ${isVideo ? "100 MB for videos" : "15 MB for images"}.`
      );
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const urlRes = await fetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          fileName: file.name,
          mimeType,
          fileSizeBytes: file.size,
        }),
      });
      const urlData = await urlRes.json().catch(() => ({}));
      if (!urlRes.ok) {
        throw new Error(urlData.error || "Upload initiation failed");
      }

      const uploadRes = urlData.isDirectUpload
        ? await fetch(urlData.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": mimeType },
            body: file,
          })
        : await fetch(urlData.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": mimeType },
            body: await file.arrayBuffer(),
          });

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.json().catch(() => ({}));
        throw new Error(uploadErr.error || `File upload failed (HTTP ${uploadRes.status})`);
      }

      const saveRes = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          fileName: file.name,
          storageKey: urlData.storageKey,
          publicUrl: urlData.publicUrl,
          mimeType,
          fileSizeBytes: file.size,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !saveData.asset) {
        throw new Error(saveData.error || "Failed to register uploaded media asset");
      }
      setMedia((prev) => [saveData.asset, ...prev]);
    } catch (err: unknown) {
      const errObj = err as Error;
      setError(errObj.message || "Media upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this media asset?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to delete media asset.");
        return;
      }
      setMedia((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("Network error while deleting media asset.");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Storage Quota Bar & Upload Header */}
      <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1 max-w-md">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-white">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-500" />
              Cloud Media Storage Usage
            </span>
            <span>
              {totalMb} MB of {maxStorageMb} MB ({usagePercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer transition-colors self-start md:self-auto">
          <Upload className="w-3.5 h-3.5" />
          <span>{isUploading ? "Uploading..." : "Upload New File"}</span>
          <input
            type="file"
            accept="image/*,video/*"
            disabled={isUploading}
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        {(["ALL", "IMAGE", "VIDEO"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterType(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterType === tab
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {tab === "ALL" && `All Media (${media.length})`}
            {tab === "IMAGE" && `Images (${media.filter((m) => m.mediaType === "IMAGE").length})`}
            {tab === "VIDEO" && `Videos (${media.filter((m) => m.mediaType === "VIDEO").length})`}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <ImageIcon className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Media library is empty
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Upload images or video files to reuse across multiple social media posts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map((asset) => (
            <div
              key={asset.id}
              className="group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative">
                {asset.mediaType === "VIDEO" ? (
                  <div className="w-full h-full flex items-center justify-center bg-black/80 text-white">
                    <Video className="w-8 h-8 opacity-75" />
                  </div>
                ) : (
                  <img
                    src={asset.publicUrl}
                    alt={asset.fileName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-white text-[10px] font-mono">
                  {asset.mediaType}
                </div>
                <button
                  onClick={() => handleDelete(asset.id)}
                  title="Delete file"
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2.5">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                  {asset.fileName}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {(asset.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB •{" "}
                  {new Date(asset.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
