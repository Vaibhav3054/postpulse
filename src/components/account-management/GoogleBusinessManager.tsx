"use client";

import { useState } from "react";
import {
  Building2,
  Clock,
  Star,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Save,
  Phone,
  Globe,
  MapPin,
  Calendar,
  MessageCircle,
  Trash2,
  Plus,
  ExternalLink,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface RegularHoursDay {
  day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface SpecialHoursItem {
  id: string;
  date: string;
  label: string;
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
}

interface ReviewItem {
  id: string;
  reviewerName: string;
  reviewerPhotoUrl?: string | null;
  starRating: number;
  comment?: string | null;
  replyText?: string | null;
  replyCreatedAt?: string | null;
  reviewCreatedAt: string;
}

interface PhotoItem {
  id: string;
  url: string;
  caption: string;
  category: string;
  uploadedAt: string;
}

interface GoogleBusinessLocation {
  id: string;
  socialAccountId: string;
  platformLocationId: string;
  locationName: string;
  primaryCategory: string | null;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  description: string | null;
  regularHours: RegularHoursDay[];
  specialHours: SpecialHoursItem[];
  attributes: Record<string, boolean>;
  coverPhotoUrl: string | null;
  logoPhotoUrl: string | null;
  photos: PhotoItem[];
  rating: number | null;
  reviewCount: number;
  lastSyncedAt: string;
  reviews: ReviewItem[];
}

interface GoogleBusinessManagerProps {
  location: GoogleBusinessLocation;
  workspaceId: string;
  socialAccountId: string;
  onRefresh?: () => void;
}

const DAYS_ORDER: ("MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY")[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export function GoogleBusinessManager({
  location: initialLocation,
  workspaceId,
  socialAccountId,
}: GoogleBusinessManagerProps) {
  const [activeTab, setActiveTab] = useState<"info" | "hours" | "reviews" | "photos">("info");
  const [location, setLocation] = useState<GoogleBusinessLocation>(initialLocation);

  // Info Form State
  const [locationName, setLocationName] = useState(location.locationName);
  const [primaryCategory, setPrimaryCategory] = useState(location.primaryCategory || "Dental Clinic");
  const [address, setAddress] = useState(location.address || "");
  const [phone, setPhone] = useState(location.phone || "");
  const [websiteUrl, setWebsiteUrl] = useState(location.websiteUrl || "");
  const [description, setDescription] = useState(location.description || "");
  const [attributes, setAttributes] = useState<Record<string, boolean>>(location.attributes || {});

  // Hours State
  const [regularHours, setRegularHours] = useState<RegularHoursDay[]>(
    Array.isArray(location.regularHours) && location.regularHours.length > 0
      ? location.regularHours
      : DAYS_ORDER.map((day) => ({
          day,
          isOpen: day !== "SUNDAY",
          openTime: "09:30",
          closeTime: "20:30",
        }))
  );
  const [specialHours, setSpecialHours] = useState<SpecialHoursItem[]>(
    Array.isArray(location.specialHours) ? location.specialHours : []
  );

  // Reviews State
  const [reviews, setReviews] = useState<ReviewItem[]>(location.reviews || []);
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "NEEDS_REPLY" | "5_STAR" | "CRITICAL">("ALL");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);

  // Photos State
  const [photos, setPhotos] = useState<PhotoItem[]>(location.photos || []);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  const [newPhotoCategory, setNewPhotoCategory] = useState("INTERIOR");
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);

  // Status & Feedback States
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReverificationModal, setShowReverificationModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- Handlers: Location Info ---
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if name or address changed
    const isSensitiveChange =
      locationName.trim() !== location.locationName.trim() ||
      address.trim() !== (location.address || "").trim();

    if (isSensitiveChange && !showReverificationModal) {
      setShowReverificationModal(true);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/account-management/google-business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          socialAccountId,
          action: "update_info",
          data: {
            locationName,
            primaryCategory,
            address,
            phone,
            websiteUrl,
            description,
            attributes,
          },
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update business information");

      setLocation((prev) => ({ ...prev, ...resData.location }));
      setShowReverificationModal(false);
      showToast("Business information updated and synced with Google Maps!");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handlers: Operating Hours ---
  const handleToggleDay = (day: string) => {
    setRegularHours((prev) =>
      prev.map((d) => (d.day === day ? { ...d, isOpen: !d.isOpen } : d))
    );
  };

  const handleTimeChange = (day: string, field: "openTime" | "closeTime", value: string) => {
    setRegularHours((prev) =>
      prev.map((d) => (d.day === day ? { ...d, [field]: value } : d))
    );
  };

  const applyIndianStandardHoursPreset = () => {
    setRegularHours(
      DAYS_ORDER.map((day) => ({
        day,
        isOpen: day !== "SUNDAY",
        openTime: "10:00",
        closeTime: "20:30",
      }))
    );
    showToast("Applied Indian Standard Business Hours preset (10:00 AM - 08:30 PM, Sun Closed)!");
  };

  const handleSaveHours = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/account-management/google-business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          socialAccountId,
          action: "update_hours",
          data: {
            regularHours,
            specialHours,
          },
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update operating hours");

      setLocation((prev) => ({ ...prev, ...resData.location }));
      showToast("Weekly operating & holiday hours synced with Google Maps!");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handlers: Customer Reviews ---
  const handleSendReply = async (reviewId: string) => {
    const text = replyDrafts[reviewId];
    if (!text || !text.trim()) return;

    setSubmittingReplyId(reviewId);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/account-management/google-business/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          socialAccountId,
          reviewId,
          replyText: text.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit review reply");

      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, replyText: text.trim(), replyCreatedAt: new Date().toISOString() } : r))
      );
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }));
      showToast("Official owner reply published to Google Maps!");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setSubmittingReplyId(null);
    }
  };

  const handleDeleteReply = async (reviewId: string) => {
    if (!confirm("Are you sure you want to remove your official reply to this review?")) return;

    setSubmittingReplyId(reviewId);
    try {
      const res = await fetch(
        `/api/account-management/google-business/reviews?workspaceId=${workspaceId}&socialAccountId=${socialAccountId}&reviewId=${reviewId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete review reply");

      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, replyText: null, replyCreatedAt: null } : r))
      );
      showToast("Review reply removed from Google Maps.");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setSubmittingReplyId(null);
    }
  };

  // --- Handlers: Photos ---
  const handleAddPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/account-management/google-business/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          socialAccountId,
          photo: {
            url: newPhotoUrl.trim(),
            caption: newPhotoCaption.trim(),
            category: newPhotoCategory,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add business photo");

      setPhotos(data.location.photos || []);
      setNewPhotoUrl("");
      setNewPhotoCaption("");
      setIsAddingPhoto(false);
      showToast("New store photo published to Google Maps Knowledge Panel!");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo from your Google Business Profile?")) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/account-management/google-business/photos?workspaceId=${workspaceId}&socialAccountId=${socialAccountId}&photoId=${photoId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete photo");

      setPhotos(data.location.photos || []);
      showToast("Photo deleted from Google Maps profile.");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === "NEEDS_REPLY") return !r.replyText;
    if (reviewFilter === "5_STAR") return r.starRating === 5;
    if (reviewFilter === "CRITICAL") return r.starRating <= 3;
    return true;
  });

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

      {/* Profile Overview Header Card */}
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#4285F4] font-extrabold text-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
            {location.logoPhotoUrl ? (
              <img src={location.logoPhotoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              "G"
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">{location.locationName}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Verified Listing
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-1">
              <span className="flex items-center gap-1 font-semibold text-amber-500">
                ★ {location.rating || 4.9}
                <span className="text-zinc-400 font-normal">({location.reviewCount} Google reviews)</span>
              </span>
              <span>•</span>
              <span className="text-zinc-400 truncate max-w-xs">{location.address || "Indiranagar, Bangalore"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <a
            href={location.websiteUrl || "https://maps.google.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors w-full sm:w-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View on Google Maps</span>
          </a>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 whitespace-nowrap ${
            activeTab === "info"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Location & Contact Info</span>
        </button>

        <button
          onClick={() => setActiveTab("hours")}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 whitespace-nowrap ${
            activeTab === "hours"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Operating & Holiday Hours</span>
        </button>

        <button
          onClick={() => setActiveTab("reviews")}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 whitespace-nowrap ${
            activeTab === "reviews"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Star className="w-3.5 h-3.5 text-amber-500" />
          <span>Customer Reviews</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
            {reviews.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("photos")}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 whitespace-nowrap ${
            activeTab === "photos"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Store Photo Gallery</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
            {photos.length}
          </span>
        </button>
      </div>

      {/* TAB 1: LOCATION & CONTACT INFO */}
      {activeTab === "info" && (
        <form onSubmit={handleSaveInfo} className="space-y-6">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-5">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Profile Details & Category
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Business Name (Maps Knowledge Panel)
                </label>
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Legal registered name displayed on Google Search & Maps.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Primary Business Category
                </label>
                <input
                  type="text"
                  required
                  value={primaryCategory}
                  onChange={(e) => setPrimaryCategory(e.target.value)}
                  placeholder="e.g. Dental Clinic, North Indian Restaurant, Retail Shop"
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Determines local SEO search ranking keyword matching.
                </span>
              </div>
            </div>

            {/* Description with Character Counter */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Business Description (Max 750 characters)
                </label>
                <span className="text-[11px] font-mono text-zinc-400">
                  {description.length} / 750
                </span>
              </div>
              <textarea
                rows={4}
                maxLength={750}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Introduce your business, specialties, team expertise, and customer care story..."
                className="w-full p-3.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white resize-none leading-relaxed"
              />
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-5">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Contact Numbers & Direct Links
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Primary Contact Phone (+91)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
                  />
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">Tapped for "Call Now" CTA on mobile.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Official Website URL
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourbusiness.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
                  />
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">Tapped for "Visit Website" button.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Physical Store Address
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="100ft Road, Indiranagar, Bengaluru"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
                  />
                </div>
                <span className="text-[10px] text-amber-500 mt-1 block">Changing street address triggers re-verification.</span>
              </div>
            </div>

            {/* Business Attributes */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Supported Amenities & Highlights
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { key: "wheelchairAccessible", label: "♿ Wheelchair Accessible" },
                  { key: "freeWifi", label: "📶 Free Wi-Fi" },
                  { key: "appointmentsRequired", label: "📅 Appointments Required" },
                  { key: "creditCardsAccepted", label: "💳 Cards Accepted" },
                  { key: "upiAccepted", label: "📱 UPI / QR Accepted" },
                  { key: "airConditioned", label: "❄️ Air Conditioned" },
                  { key: "valetParking", label: "🚗 Valet Parking" },
                  { key: "contactlessPayment", label: "⚡ Contactless Payment" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(attributes[item.key])}
                      onChange={(e) =>
                        setAttributes((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving to Google..." : "Save Business Information"}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: OPERATING & HOLIDAY HOURS */}
      {activeTab === "hours" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Regular Weekly Operating Hours
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Customers on Google Maps will see "Open Now" or "Closed" based on these exact timings (IST).
                </p>
              </div>
              <button
                type="button"
                onClick={applyIndianStandardHoursPreset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply Indian Standard Timings</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {regularHours.map((d) => (
                <div
                  key={d.day}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    d.isOpen
                      ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                      : "border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-950/40 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3 w-36">
                    <input
                      type="checkbox"
                      id={`day_${d.day}`}
                      checked={d.isOpen}
                      onChange={() => handleToggleDay(d.day)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor={`day_${d.day}`}
                      className="text-xs font-semibold text-zinc-900 dark:text-white capitalize cursor-pointer"
                    >
                      {d.day.toLowerCase()}
                    </label>
                  </div>

                  {d.isOpen ? (
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="time"
                        value={d.openTime}
                        onChange={(e) => handleTimeChange(d.day, "openTime", e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-zinc-900 dark:text-white text-xs"
                      />
                      <span className="text-zinc-400">to</span>
                      <input
                        type="time"
                        value={d.closeTime}
                        onChange={(e) => handleTimeChange(d.day, "closeTime", e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-zinc-900 dark:text-white text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Special Holiday Hours */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Special & Festive Holiday Hours</span>
            </h4>
            <p className="text-xs text-zinc-500">
              Overrides normal hours on Indian national holidays and festivals without changing your weekly routine.
            </p>

            <div className="space-y-2.5">
              {specialHours.map((sh, idx) => (
                <div
                  key={sh.id || idx}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-500 text-[11px]">{sh.date}</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{sh.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {sh.isClosed ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                        Closed All Day
                      </span>
                    ) : (
                      <span className="font-mono text-emerald-600 text-[11px]">
                        {sh.openTime} - {sh.closeTime}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSpecialHours((prev) => prev.filter((item) => item.id !== sh.id))}
                      className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveHours}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Syncing Hours..." : "Save Operating Hours"}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER REVIEWS & REPLIES */}
      {activeTab === "reviews" && (
        <div className="space-y-6">
          {/* Rating Summary Bar */}
          <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-extrabold text-zinc-900 dark:text-white">
                {location.rating || 4.9}
              </div>
              <div>
                <div className="flex items-center text-amber-400 text-sm">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">Based on {reviews.length} customer reviews</div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setReviewFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  reviewFilter === "ALL"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                All ({reviews.length})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("NEEDS_REPLY")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  reviewFilter === "NEEDS_REPLY"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Needs Reply ({reviews.filter((r) => !r.replyText).length})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("5_STAR")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  reviewFilter === "5_STAR"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                5 Stars ({reviews.filter((r) => r.starRating === 5).length})
              </button>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {filteredReviews.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs text-zinc-400">
                No reviews found under this filter.
              </div>
            ) : (
              filteredReviews.map((r) => {
                const isSubmitting = submittingReplyId === r.id;
                const draft = replyDrafts[r.id] ?? "";

                return (
                  <div
                    key={r.id}
                    className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden font-bold text-xs flex items-center justify-center text-zinc-600">
                          {r.reviewerPhotoUrl ? (
                            <img src={r.reviewerPhotoUrl} alt={r.reviewerName} className="w-full h-full object-cover" />
                          ) : (
                            r.reviewerName[0]
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-zinc-900 dark:text-white">{r.reviewerName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex items-center text-amber-400">
                              {[...Array(r.starRating)].map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-amber-400" />
                              ))}
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {new Date(r.reviewCreatedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {r.replyText ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          Replied
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          Awaiting Reply
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {r.comment || "Rating only review"}
                    </p>

                    {/* Official Business Reply Block */}
                    {r.replyText ? (
                      <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-1.5 mt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-blue-900 dark:text-blue-300">
                            Response from {location.locationName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteReply(r.id)}
                            className="text-zinc-400 hover:text-rose-600 text-[10px] transition-colors"
                          >
                            Delete reply
                          </button>
                        </div>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-normal">{r.replyText}</p>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                        <textarea
                          rows={2}
                          value={draft}
                          onChange={(e) => setReplyDrafts({ ...replyDrafts, [r.id]: e.target.value })}
                          placeholder="Type official owner reply to publish on Google Maps..."
                          className="w-full p-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-900 dark:text-white resize-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSendReply(r.id)}
                            disabled={isSubmitting || !draft.trim()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{isSubmitting ? "Publishing..." : "Reply to Customer"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STORE PHOTO GALLERY */}
      {activeTab === "photos" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Store & Clinic Visual Gallery ({photos.length} Photos)
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingPhoto(!isAddingPhoto)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload New Photo</span>
            </button>
          </div>

          {/* Add Photo Drawer */}
          {isAddingPhoto && (
            <form onSubmit={handleAddPhotoSubmit} className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3 text-xs">
              <div className="font-semibold text-blue-900 dark:text-blue-300">Publish New Photo to Google Maps</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Image Public URL
                  </label>
                  <input
                    type="url"
                    required
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/... or uploaded asset URL"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newPhotoCategory}
                    onChange={(e) => setNewPhotoCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-900 dark:text-white"
                  >
                    <option value="INTERIOR">Interior View</option>
                    <option value="EXTERIOR">Exterior / Entrance</option>
                    <option value="TEAM">Team / Staff</option>
                    <option value="FOOD_AND_DRINK">Food & Drinks</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Photo Caption
                </label>
                <input
                  type="text"
                  value={newPhotoCaption}
                  onChange={(e) => setNewPhotoCaption(e.target.value)}
                  placeholder="e.g. Modern consultation cabin with advanced laser equipment"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingPhoto(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
                >
                  {isSaving ? "Uploading..." : "Publish to Google Maps"}
                </button>
              </div>
            </form>
          )}

          {/* Photo Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {photos.map((p) => (
              <div
                key={p.id}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-sm"
              >
                <img src={p.url} alt={p.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/60 text-white">
                      {p.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(p.id)}
                      title="Delete from Google Business Profile"
                      className="p-1 rounded-full bg-rose-600 text-white hover:bg-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-white text-xs font-medium line-clamp-2">{p.caption}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Confirmation Modal for Re-verification Sensitive Changes */}
      {showReverificationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Google Re-verification Risk Alert
              </h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              You are about to change your <strong>Business Name</strong> or <strong>Physical Street Address</strong>.
              Google's automated fraud detection filters may temporarily place your listing into <em>"Under Review"</em> and require phone, postcard, or video re-verification.
            </p>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-[11px] text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Only proceed if your business has legally rebranded or officially relocated its premises.
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowReverificationModal(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInfo}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all"
              >
                {isSaving ? "Syncing..." : "I Understand, Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
