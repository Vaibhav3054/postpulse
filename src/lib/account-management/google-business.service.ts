import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";

export interface RegularHoursDay {
  day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  isOpen: boolean;
  openTime: string; // "09:30"
  closeTime: string; // "20:30"
}

export interface SpecialHoursItem {
  id: string;
  date: string; // "YYYY-MM-DD"
  label: string; // e.g. "Diwali Festival"
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface BusinessPhotoItem {
  id: string;
  url: string;
  caption: string;
  category: "INTERIOR" | "EXTERIOR" | "LOGO" | "COVER" | "TEAM";
  uploadedAt: string;
}

const DEFAULT_REGULAR_HOURS: RegularHoursDay[] = [
  { day: "MONDAY", isOpen: true, openTime: "09:30", closeTime: "20:30" },
  { day: "TUESDAY", isOpen: true, openTime: "09:30", closeTime: "20:30" },
  { day: "WEDNESDAY", isOpen: true, openTime: "09:30", closeTime: "20:30" },
  { day: "THURSDAY", isOpen: true, openTime: "09:30", closeTime: "20:30" },
  { day: "FRIDAY", isOpen: true, openTime: "09:30", closeTime: "20:30" },
  { day: "SATURDAY", isOpen: true, openTime: "09:30", closeTime: "20:30" },
  { day: "SUNDAY", isOpen: false, openTime: "10:00", closeTime: "14:00" },
];

const DEFAULT_SPECIAL_HOURS: SpecialHoursItem[] = [
  { id: "sh_1", date: "2026-11-08", label: "Diwali (Deepavali)", isClosed: true },
  { id: "sh_2", date: "2026-12-25", label: "Christmas Day", isClosed: false, openTime: "11:00", closeTime: "17:00" },
  { id: "sh_3", date: "2027-01-26", label: "Republic Day", isClosed: true },
];

const DEFAULT_PHOTOS: BusinessPhotoItem[] = [
  {
    id: "photo_1",
    url: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop&q=80",
    caption: "Reception and waiting lounge",
    category: "INTERIOR",
    uploadedAt: "2026-11-10T10:00:00Z",
  },
  {
    id: "photo_2",
    url: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80",
    caption: "Advanced sterilization and operatory suite",
    category: "INTERIOR",
    uploadedAt: "2026-11-11T11:30:00Z",
  },
  {
    id: "photo_3",
    url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&auto=format&fit=crop&q=80",
    caption: "Clinic exterior & entrance on 100ft road",
    category: "EXTERIOR",
    uploadedAt: "2026-11-12T14:15:00Z",
  },
];

export const GoogleBusinessManagementService = {
  /**
   * Retrieves or initializes the BusinessProfileLocation and cached reviews
   */
  async getOrCreateLocation(socialAccountId: string) {
    let profile = await db.businessProfiles.findBySocialAccountId(socialAccountId);

    if (!profile) {
      const socialAccount = await db.socialAccounts.findById(socialAccountId);
      if (!socialAccount) {
        throw new Error("Social account not found");
      }

      const meta = (socialAccount.metadata as Record<string, unknown>) || {};
      const locationName = socialAccount.platformDisplayName || "Royal Dental & Implant Clinic";
      const primaryCategory = (meta.primaryCategory as string) || "Dental Clinic";
      const address = (meta.address as string) || "100ft Road, Indiranagar, Bengaluru, Karnataka 560038";
      const phone = (meta.phone as string) || "+91 98450 12345";
      const websiteUrl = (meta.googleMapsUrl as string) || "https://royaldentalclinic.in";
      const description =
        "Premier dental clinic offering painless laser dentistry, invisible aligners, dental implants, and smile makeovers with state-of-the-art international protocols. Trusted by over 10,000+ happy smiles.";

      profile = await db.businessProfiles.upsert({
        socialAccountId,
        platformLocationId: socialAccount.platformAccountId,
        locationName,
        primaryCategory,
        address,
        phone,
        websiteUrl,
        description,
        regularHours: DEFAULT_REGULAR_HOURS,
        specialHours: DEFAULT_SPECIAL_HOURS,
        attributes: {
          wheelchairAccessible: true,
          freeWifi: true,
          appointmentsRequired: true,
          creditCardsAccepted: true,
          upiAccepted: true,
        },
        coverPhotoUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80",
        logoPhotoUrl: socialAccount.avatarUrl || "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150&auto=format&fit=crop&q=80",
        photos: DEFAULT_PHOTOS,
        rating: 4.9,
        reviewCount: 384,
      });

      // Seed initial customer reviews
      await prisma.customerReview.createMany({
        data: [
          {
            locationId: profile.id,
            platformReviewId: `rev_${Date.now()}_1`,
            reviewerName: "Aarav Sharma",
            reviewerPhotoUrl:
              "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
            starRating: 5,
            comment:
              "Outstanding dental implant care! Dr. Sharma and the staff were exceptionally gentle and professional. The clinic is spotless and state-of-the-art. Highly recommended in Indiranagar!",
            replyText:
              "Thank you so much Aarav! We are delighted to hear about your smooth recovery and positive experience. Looking forward to your next routine checkup!",
            replyCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            reviewCreatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
          {
            locationId: profile.id,
            platformReviewId: `rev_${Date.now()}_2`,
            reviewerName: "Pooja Hegde",
            reviewerPhotoUrl:
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
            starRating: 5,
            comment:
              "Very polite team and quick appointment scheduling. Loved the transparent consultation on clear aligners. 5 stars all the way!",
            replyText: null,
            replyCreatedAt: null,
            reviewCreatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          },
          {
            locationId: profile.id,
            platformReviewId: `rev_${Date.now()}_3`,
            reviewerName: "Vikram Patel",
            reviewerPhotoUrl:
              "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
            starRating: 4,
            comment:
              "Treatment was great, but parking on 100ft road can be tricky during peak evening hours. Other than that, top-tier service.",
            replyText:
              "Hi Vikram, thanks for the constructive feedback! We have now arranged designated valet parking behind the clinic for all our evening patients.",
            replyCreatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            reviewCreatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        ],
        skipDuplicates: true,
      });

      // Refetch with reviews
      profile = await db.businessProfiles.findBySocialAccountId(socialAccountId);
    }

    return profile;
  },

  /**
   * Updates Business Profile Information (Name, Description, Phone, Website, Category)
   */
  async updateInfo(
    socialAccountId: string,
    userId: string,
    workspaceId: string,
    info: {
      locationName?: string;
      description?: string;
      phone?: string;
      websiteUrl?: string;
      primaryCategory?: string;
      address?: string;
      attributes?: Record<string, boolean>;
    }
  ) {
    const profile = await this.getOrCreateLocation(socialAccountId);
    if (!profile) throw new Error("Location profile not found");

    const previousValue = {
      locationName: profile.locationName,
      description: profile.description,
      phone: profile.phone,
      websiteUrl: profile.websiteUrl,
      primaryCategory: profile.primaryCategory,
      address: profile.address,
    };

    const updated = await db.businessProfiles.updateInfo(profile.id, info);

    // Audit log
    await db.activity.log({
      workspaceId,
      userId,
      action: "GBP_INFO_UPDATED",
      entityType: "GOOGLE_BUSINESS_PROFILE",
      entityId: profile.id,
      metadata: {
        previousValue,
        newValue: info,
      },
    });

    // If live API credentials available, sync with Google Business Information API
    try {
      const socialAccount = profile.socialAccount;
      if (socialAccount && !socialAccount.accessTokenEncrypted.startsWith("gbp_access_token_")) {
        const token = decryptToken(socialAccount.accessTokenEncrypted);
        await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${profile.platformLocationId}?updateMask=profile.description,primaryPhone,websiteUri`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              profile: { description: info.description },
              primaryPhone: info.phone,
              websiteUri: info.websiteUrl,
            }),
          }
        );
      }
    } catch (e) {
      console.warn("Live GBP API sync warning:", e);
    }

    return updated;
  },

  /**
   * Updates Regular Weekly and Special Holiday Operating Hours
   */
  async updateHours(
    socialAccountId: string,
    userId: string,
    workspaceId: string,
    regularHours: RegularHoursDay[],
    specialHours?: SpecialHoursItem[]
  ) {
    const profile = await this.getOrCreateLocation(socialAccountId);
    if (!profile) throw new Error("Location profile not found");

    const previousHours = {
      regularHours: profile.regularHours,
      specialHours: profile.specialHours,
    };

    const updated = await db.businessProfiles.updateHours(profile.id, regularHours, specialHours);

    // Audit log
    await db.activity.log({
      workspaceId,
      userId,
      action: "GBP_HOURS_UPDATED",
      entityType: "GOOGLE_BUSINESS_PROFILE",
      entityId: profile.id,
      metadata: {
        previousHours,
        updatedHours: { regularHours, specialHours },
      },
    });

    return updated;
  },

  /**
   * Replies to a customer review
   */
  async replyToReview(
    socialAccountId: string,
    userId: string,
    workspaceId: string,
    reviewId: string,
    replyText: string
  ) {
    const profile = await this.getOrCreateLocation(socialAccountId);
    if (!profile) throw new Error("Location profile not found");

    const updatedReview = await db.businessProfiles.reviews.reply(reviewId, replyText);

    // Audit log
    await db.activity.log({
      workspaceId,
      userId,
      action: "GBP_REVIEW_REPLIED",
      entityType: "CUSTOMER_REVIEW",
      entityId: reviewId,
      metadata: {
        replyText,
        reviewerName: updatedReview.reviewerName,
        starRating: updatedReview.starRating,
      },
    });

    return updatedReview;
  },

  /**
   * Deletes a review reply
   */
  async deleteReviewReply(
    socialAccountId: string,
    userId: string,
    workspaceId: string,
    reviewId: string
  ) {
    const profile = await this.getOrCreateLocation(socialAccountId);
    if (!profile) throw new Error("Location profile not found");

    const updatedReview = await db.businessProfiles.reviews.deleteReply(reviewId);

    // Audit log
    await db.activity.log({
      workspaceId,
      userId,
      action: "GBP_REVIEW_REPLY_DELETED",
      entityType: "CUSTOMER_REVIEW",
      entityId: reviewId,
      metadata: {
        reviewerName: updatedReview.reviewerName,
      },
    });

    return updatedReview;
  },

  /**
   * Adds a business photo
   */
  async addPhoto(
    socialAccountId: string,
    userId: string,
    workspaceId: string,
    photo: { url: string; caption?: string; category?: string }
  ) {
    const profile = await this.getOrCreateLocation(socialAccountId);
    if (!profile) throw new Error("Location profile not found");

    const updated = await db.businessProfiles.addPhoto(profile.id, photo);

    await db.activity.log({
      workspaceId,
      userId,
      action: "GBP_PHOTO_ADDED",
      entityType: "GOOGLE_BUSINESS_PROFILE",
      entityId: profile.id,
      metadata: { photoUrl: photo.url, category: photo.category },
    });

    return updated;
  },

  /**
   * Deletes a business photo
   */
  async deletePhoto(
    socialAccountId: string,
    userId: string,
    workspaceId: string,
    photoId: string
  ) {
    const profile = await this.getOrCreateLocation(socialAccountId);
    if (!profile) throw new Error("Location profile not found");

    const updated = await db.businessProfiles.deletePhoto(profile.id, photoId);

    await db.activity.log({
      workspaceId,
      userId,
      action: "GBP_PHOTO_DELETED",
      entityType: "GOOGLE_BUSINESS_PROFILE",
      entityId: profile.id,
      metadata: { photoId },
    });

    return updated;
  },
};
