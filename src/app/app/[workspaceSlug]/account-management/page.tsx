import { requireServerWorkspaceAccess } from "@/lib/authorization";
import { db } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { AccountManagementView } from "@/components/account-management/AccountManagementView";
import { GoogleBusinessManagementService } from "@/lib/account-management/google-business.service";

export default async function AccountManagementPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireServerWorkspaceAccess(workspaceSlug);

  const accounts = await db.socialAccounts.listForWorkspace(workspace.id);
  const logs = await db.activity.listForWorkspace(workspace.id, 25);

  // If a Google Business Profile account is connected, retrieve or initialize its location profile
  const gbpAccount = accounts.find((a) => a.platform === "GOOGLE_BUSINESS");
  let gbpLocation: any = null;

  if (gbpAccount) {
    try {
      const locationDoc = await GoogleBusinessManagementService.getOrCreateLocation(gbpAccount.id);
      if (locationDoc) {
        gbpLocation = {
          id: locationDoc.id,
          socialAccountId: locationDoc.socialAccountId,
          platformLocationId: locationDoc.platformLocationId,
          locationName: locationDoc.locationName,
          primaryCategory: locationDoc.primaryCategory,
          address: locationDoc.address,
          phone: locationDoc.phone,
          websiteUrl: locationDoc.websiteUrl,
          description: locationDoc.description,
          regularHours: locationDoc.regularHours as any,
          specialHours: locationDoc.specialHours as any,
          attributes: (locationDoc.attributes as any) || {},
          coverPhotoUrl: locationDoc.coverPhotoUrl,
          logoPhotoUrl: locationDoc.logoPhotoUrl,
          photos: (locationDoc.photos as any) || [],
          rating: locationDoc.rating,
          reviewCount: locationDoc.reviewCount,
          lastSyncedAt: locationDoc.lastSyncedAt.toISOString(),
          reviews: locationDoc.reviews.map((r) => ({
            id: r.id,
            reviewerName: r.reviewerName,
            reviewerPhotoUrl: r.reviewerPhotoUrl,
            starRating: r.starRating,
            comment: r.comment,
            replyText: r.replyText,
            replyCreatedAt: r.replyCreatedAt?.toISOString() || null,
            reviewCreatedAt: r.reviewCreatedAt.toISOString(),
          })),
        };
      }
    } catch (e) {
      console.error("Error retrieving GBP location:", e);
    }
  }

  const formattedAccounts = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    platformAccountId: a.platformAccountId,
    platformUsername: a.platformUsername,
    platformDisplayName: a.platformDisplayName,
    avatarUrl: a.avatarUrl,
    metadata: (a.metadata as Record<string, unknown>) || {},
    isActive: a.isActive,
  }));

  const formattedLogs = logs
    .filter((l) => l.action.startsWith("GBP_") || l.action.startsWith("FB_") || l.entityType === "ACCOUNT_MANAGEMENT")
    .map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      createdAt: l.createdAt.toISOString(),
      metadata: (l.metadata as Record<string, unknown>) || undefined,
    }));

  return (
    <>
      <Header title="Account Management" workspaceSlug={workspace.slug} />
      <AccountManagementView
        accounts={formattedAccounts}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        gbpLocation={gbpLocation}
        logs={formattedLogs}
      />
    </>
  );
}
