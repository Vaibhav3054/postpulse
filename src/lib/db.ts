import { prisma } from "./prisma";
import { SUBSCRIPTION_PLANS, QuotaExceededError } from "./quota";
import {
  SocialPlatform,
  MediaType,
  PostStatus,
  TargetPublishStatus,
  WorkspaceRole,
  SystemRole,
} from "@prisma/client";

export const db = {
  users: {
    async findByEmail(email: string) {
      try {
        return await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
      } catch (err) {
        console.error("Prisma findByEmail error:", err);
        return null;
      }
    },

    async findById(id: string) {
      try {
        return await prisma.user.findUnique({
          where: { id },
        });
      } catch (err) {
        console.error("Prisma findById error:", err);
        return null;
      }
    },

    async create(data: {
      email: string;
      passwordHash: string;
      fullName?: string;
      avatarUrl?: string;
    }) {
      const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { code: "free" },
      });

      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash,
          fullName: data.fullName || "Creator",
          avatarUrl: data.avatarUrl || "",
          systemRole: SystemRole.USER,
        },
      });

      // Auto-create initial default personal workspace
      const baseSlug = (data.fullName || "brand")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

      const workspace = await prisma.workspace.create({
        data: {
          name: `${data.fullName || "My"} Brand`,
          slug: uniqueSlug,
          ownerId: user.id,
          planId: freePlan ? freePlan.id : "",
          members: {
            create: {
              userId: user.id,
              role: WorkspaceRole.OWNER,
            },
          },
        },
      });

      return user;
    },
  },

  workspaces: {
    async listForUser(userId: string) {
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId },
        include: {
          workspace: {
            include: {
              plan: true,
            },
          },
        },
      });

      return memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        logoUrl: m.workspace.logoUrl,
        ownerId: m.workspace.ownerId,
        planId: m.workspace.plan.code,
        planName: m.workspace.plan.name,
        role: m.role,
        createdAt: m.workspace.createdAt,
        updatedAt: m.workspace.updatedAt,
      }));
    },

    async findBySlug(slug: string) {
      return prisma.workspace.findUnique({
        where: { slug },
        include: {
          plan: true,
        },
      });
    },

    async findById(id: string) {
      return prisma.workspace.findUnique({
        where: { id },
        include: {
          plan: true,
        },
      });
    },

    async checkMembership(workspaceId: string, userId: string) {
      return prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });
    },

    async create(data: { name: string; slug: string; ownerId: string }) {
      const userWorkspaces = await prisma.workspace.count({
        where: { ownerId: data.ownerId },
      });

      if (userWorkspaces >= 50) {
        throw new QuotaExceededError("workspaces", 50, userWorkspaces, "agency");
      }

      const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { code: "free" },
      });

      let uniqueSlug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const existing = await prisma.workspace.findUnique({ where: { slug: uniqueSlug } });
      if (existing) {
        uniqueSlug = `${uniqueSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      return prisma.workspace.create({
        data: {
          name: data.name,
          slug: uniqueSlug,
          ownerId: data.ownerId,
          planId: freePlan ? freePlan.id : "",
          members: {
            create: {
              userId: data.ownerId,
              role: WorkspaceRole.OWNER,
            },
          },
        },
      });
    },

    async update(id: string, data: { name?: string; slug?: string; planId?: string }) {
      const updatePayload: Record<string, unknown> = {};
      if (data.name) updatePayload.name = data.name;
      if (data.slug) updatePayload.slug = data.slug;
      if (data.planId) {
        const plan = await prisma.subscriptionPlan.findUnique({ where: { code: data.planId } });
        if (plan) updatePayload.planId = plan.id;
      }

      return prisma.workspace.update({
        where: { id },
        data: updatePayload,
      });
    },

    async delete(id: string) {
      return prisma.workspace.delete({
        where: { id },
      });
    },
  },

  socialAccounts: {
    async listForWorkspace(workspaceId: string) {
      return prisma.socialAccount.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async findById(id: string) {
      return prisma.socialAccount.findUnique({
        where: { id },
      });
    },

    async create(data: {
      workspaceId: string;
      platform: SocialPlatform;
      platformAccountId: string;
      platformUsername?: string;
      platformDisplayName?: string;
      avatarUrl?: string;
      accessTokenEncrypted: string;
      refreshTokenEncrypted?: string;
      tokenExpiresAt?: Date;
      scopes?: string[];
      metadata?: Record<string, unknown>;
      isActive?: boolean;
    }) {
      const ws = await prisma.workspace.findUnique({
        where: { id: data.workspaceId },
        include: { plan: true },
      });

      const currentCount = await prisma.socialAccount.count({
        where: { workspaceId: data.workspaceId, isActive: true },
      });

      const planLimit = ws?.plan?.maxSocialAccounts || 3;
      if (currentCount >= planLimit) {
        throw new QuotaExceededError(
          "social_accounts",
          planLimit,
          currentCount,
          ws?.plan?.code || "free"
        );
      }

      return prisma.socialAccount.upsert({
        where: {
          workspaceId_platform_platformAccountId: {
            workspaceId: data.workspaceId,
            platform: data.platform,
            platformAccountId: data.platformAccountId,
          },
        },
        update: {
          ...data,
          metadata: (data.metadata || {}) as any,
          isActive: true,
        },
        create: {
          ...data,
          metadata: (data.metadata || {}) as any,
          isActive: true,
        },
      });
    },

    async disconnect(id: string) {
      return prisma.socialAccount.update({
        where: { id },
        data: { isActive: false },
      });
    },
  },

  mediaAssets: {
    async listForWorkspace(workspaceId: string) {
      const assets = await prisma.mediaAsset.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
      });

      return assets.map((a) => ({
        ...a,
        fileSizeBytes: Number(a.fileSizeBytes),
      }));
    },

    async findById(id: string) {
      const a = await prisma.mediaAsset.findUnique({ where: { id } });
      if (!a) return null;
      return {
        ...a,
        fileSizeBytes: Number(a.fileSizeBytes),
      };
    },

    async create(data: {
      workspaceId: string;
      fileName: string;
      storageKey: string;
      publicUrl: string;
      mediaType: MediaType;
      mimeType: string;
      fileSizeBytes: number;
      width?: number;
      height?: number;
      durationSeconds?: number;
      isTemporary?: boolean;
    }) {
      const asset = await prisma.mediaAsset.create({
        data: {
          ...data,
          fileSizeBytes: BigInt(data.fileSizeBytes),
        },
      });

      return {
        ...asset,
        fileSizeBytes: Number(asset.fileSizeBytes),
      };
    },

    async delete(id: string) {
      return prisma.mediaAsset.delete({ where: { id } });
    },
  },

  posts: {
    async listForWorkspace(
      workspaceId: string,
      options?: { status?: string; platform?: string }
    ) {
      const where: any = { workspaceId };

      if (options?.status && options.status !== "ALL") {
        where.status = options.status as PostStatus;
      }

      if (options?.platform && options.platform !== "ALL") {
        where.platformTargets = {
          some: {
            platform: options.platform as SocialPlatform,
          },
        };
      }

      const posts = await prisma.post.findMany({
        where,
        include: {
          media: {
            include: {
              mediaAsset: true,
            },
            orderBy: { displayOrder: "asc" },
          },
          platformTargets: {
            include: {
              socialAccount: true,
            },
          },
        },
        orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      });

      return posts.map((p) => ({
        id: p.id,
        workspaceId: p.workspaceId,
        createdByUserId: p.createdByUserId || "",
        status: p.status,
        commonCaption: p.commonCaption || "",
        scheduledAt: p.scheduledAt || undefined,
        timezone: p.timezone,
        publishedAt: p.publishedAt || undefined,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        media: p.media.map((m) => ({
          id: m.mediaAsset.id,
          fileName: m.mediaAsset.fileName,
          publicUrl: m.mediaAsset.publicUrl,
          mediaType: m.mediaAsset.mediaType,
          fileSizeBytes: Number(m.mediaAsset.fileSizeBytes),
        })),
        platformTargets: p.platformTargets.map((t) => ({
          id: t.id,
          postId: t.postId,
          socialAccountId: t.socialAccountId,
          platform: t.platform,
          customCaption: t.customCaption || undefined,
          platformPayload: (t.platformPayload as Record<string, unknown>) || {},
          status: t.status,
          externalPostId: t.externalPostId || undefined,
          externalPostUrl: t.externalPostUrl || undefined,
          errorMessage: t.errorMessage || undefined,
          errorDetails: (t.errorDetails as Record<string, unknown>) || undefined,
          publishedAt: t.publishedAt || undefined,
          idempotencyKey: t.idempotencyKey,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      }));
    },

    async findById(id: string) {
      const p = await prisma.post.findUnique({
        where: { id },
        include: {
          media: {
            include: {
              mediaAsset: true,
            },
            orderBy: { displayOrder: "asc" },
          },
          platformTargets: {
            include: {
              socialAccount: true,
            },
          },
        },
      });

      if (!p) return null;

      return {
        id: p.id,
        workspaceId: p.workspaceId,
        createdByUserId: p.createdByUserId || "",
        status: p.status,
        commonCaption: p.commonCaption || "",
        scheduledAt: p.scheduledAt || undefined,
        timezone: p.timezone,
        publishedAt: p.publishedAt || undefined,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        media: p.media.map((m) => ({
          id: m.mediaAsset.id,
          fileName: m.mediaAsset.fileName,
          publicUrl: m.mediaAsset.publicUrl,
          mediaType: m.mediaAsset.mediaType,
          fileSizeBytes: Number(m.mediaAsset.fileSizeBytes),
        })),
        platformTargets: p.platformTargets.map((t) => ({
          id: t.id,
          postId: t.postId,
          socialAccountId: t.socialAccountId,
          platform: t.platform,
          customCaption: t.customCaption || undefined,
          platformPayload: (t.platformPayload as Record<string, unknown>) || {},
          status: t.status,
          externalPostId: t.externalPostId || undefined,
          externalPostUrl: t.externalPostUrl || undefined,
          errorMessage: t.errorMessage || undefined,
          errorDetails: (t.errorDetails as Record<string, unknown>) || undefined,
          publishedAt: t.publishedAt || undefined,
          idempotencyKey: t.idempotencyKey,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      };
    },

    async create(data: {
      workspaceId: string;
      createdByUserId: string;
      status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
      commonCaption: string;
      scheduledAt?: Date;
      timezone?: string;
      mediaAssetIds?: string[];
      targets: {
        socialAccountId: string;
        platform: SocialPlatform;
        customCaption?: string;
        platformPayload?: Record<string, unknown>;
      }[];
    }) {
      const ws = await prisma.workspace.findUnique({
        where: { id: data.workspaceId },
        include: { plan: true },
      });

      if (data.status === "SCHEDULED") {
        const scheduledCount = await prisma.post.count({
          where: {
            workspaceId: data.workspaceId,
            status: PostStatus.SCHEDULED,
          },
        });
        const maxLimit = ws?.plan?.maxScheduledPostsPerMonth || 15;
        if (scheduledCount >= maxLimit) {
          throw new QuotaExceededError(
            "scheduled_posts",
            maxLimit,
            scheduledCount,
            ws?.plan?.code || "free"
          );
        }
      }

      const post = await prisma.post.create({
        data: {
          workspaceId: data.workspaceId,
          createdByUserId: data.createdByUserId,
          status: data.status as PostStatus,
          commonCaption: data.commonCaption,
          scheduledAt: data.scheduledAt,
          timezone: data.timezone || "UTC",
          publishedAt: data.status === "PUBLISHED" ? new Date() : undefined,
          media: {
            create: (data.mediaAssetIds || []).map((assetId, idx) => ({
              mediaAssetId: assetId,
              displayOrder: idx,
            })),
          },
          platformTargets: {
            create: data.targets.map((t) => ({
              socialAccountId: t.socialAccountId,
              platform: t.platform,
              customCaption: t.customCaption,
              platformPayload: (t.platformPayload || {}) as any,
              status:
                data.status === "PUBLISHED"
                  ? TargetPublishStatus.PUBLISHED
                  : TargetPublishStatus.PENDING,
              publishedAt: data.status === "PUBLISHED" ? new Date() : undefined,
              idempotencyKey: `target_${Date.now()}_${t.socialAccountId}_${Math.random()
                .toString(36)
                .substring(2, 6)}`,
            })),
          },
        },
        include: {
          platformTargets: true,
          media: { include: { mediaAsset: true } },
        },
      });

      return {
        ...post,
        mediaAssetIds: data.mediaAssetIds || [],
        media: post.media.map((m) => ({
          id: m.mediaAsset.id,
          fileName: m.mediaAsset.fileName,
          publicUrl: m.mediaAsset.publicUrl,
          mediaType: m.mediaAsset.mediaType,
          fileSizeBytes: Number(m.mediaAsset.fileSizeBytes),
        })),
      };
    },

    async update(id: string, data: Partial<any>) {
      return prisma.post.update({
        where: { id },
        data,
      });
    },

    async delete(id: string) {
      return prisma.post.delete({ where: { id } });
    },

    async findDuePosts() {
      const now = new Date();
      const posts = await prisma.post.findMany({
        where: {
          status: PostStatus.SCHEDULED,
          scheduledAt: { lte: now },
        },
        include: {
          media: { include: { mediaAsset: true } },
          platformTargets: true,
        },
      });

      return posts.map((p) => ({
        ...p,
        media: p.media.map((m) => ({
          id: m.mediaAsset.id,
          fileName: m.mediaAsset.fileName,
          publicUrl: m.mediaAsset.publicUrl,
          mediaType: m.mediaAsset.mediaType,
          fileSizeBytes: Number(m.mediaAsset.fileSizeBytes),
        })),
        platformTargets: p.platformTargets.map((t) => ({
          ...t,
          customCaption: t.customCaption || undefined,
          platformPayload: (t.platformPayload as Record<string, unknown>) || {},
          errorDetails: (t.errorDetails as Record<string, unknown>) || undefined,
        })),
      }));
    },

    async updateTargetStatus(
      targetId: string,
      status: "PUBLISHED" | "FAILED",
      details?: {
        externalPostId?: string;
        externalPostUrl?: string;
        errorMessage?: string;
        errorDetails?: Record<string, unknown>;
      }
    ) {
      const updatedTarget = await prisma.postPlatformTarget.update({
        where: { id: targetId },
        data: {
          status: status as TargetPublishStatus,
          publishedAt: status === "PUBLISHED" ? new Date() : undefined,
          externalPostId: details?.externalPostId,
          externalPostUrl: details?.externalPostUrl,
          errorMessage: details?.errorMessage,
          errorDetails: (details?.errorDetails || {}) as any,
        },
      });

      // Recalculate post status
      const allTargets = await prisma.postPlatformTarget.findMany({
        where: { postId: updatedTarget.postId },
      });

      const allPublished = allTargets.every((t) => t.status === TargetPublishStatus.PUBLISHED);
      const anyPublished = allTargets.some((t) => t.status === TargetPublishStatus.PUBLISHED);
      const anyFailed = allTargets.some((t) => t.status === TargetPublishStatus.FAILED);

      let newPostStatus: PostStatus = PostStatus.PUBLISHING;
      if (allPublished) {
        newPostStatus = PostStatus.PUBLISHED;
      } else if (anyPublished && anyFailed) {
        newPostStatus = PostStatus.PARTIALLY_PUBLISHED;
      } else if (anyFailed) {
        newPostStatus = PostStatus.FAILED;
      }

      await prisma.post.update({
        where: { id: updatedTarget.postId },
        data: {
          status: newPostStatus,
          publishedAt: newPostStatus === PostStatus.PUBLISHED ? new Date() : undefined,
        },
      });
    },
  },

  attempts: {
    async record(data: {
      postPlatformTargetId: string;
      attemptNumber: number;
      status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED";
      requestSummary?: Record<string, unknown>;
      responseSummary?: Record<string, unknown>;
      errorCode?: string;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
      durationMs?: number;
    }) {
      return prisma.publishAttempt.create({
        data: {
          postPlatformTargetId: data.postPlatformTargetId,
          attemptNumber: data.attemptNumber,
          status: data.status as TargetPublishStatus,
          requestSummary: (data.requestSummary || {}) as any,
          responseSummary: (data.responseSummary || {}) as any,
          errorCode: data.errorCode,
          errorMessage: data.errorMessage,
          durationMs: data.durationMs,
        },
      });
    },

    async listForTarget(targetId: string) {
      return prisma.publishAttempt.findMany({
        where: { postPlatformTargetId: targetId },
        orderBy: { executedAt: "desc" },
      });
    },
  },

  activity: {
    async log(data: {
      workspaceId: string;
      userId?: string;
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
    }) {
      try {
        await prisma.activityLog.create({
          data: {
            workspaceId: data.workspaceId,
            userId: data.userId,
            action: data.action,
            entityType: data.entityType,
            entityId: data.entityId,
            metadata: (data.metadata || {}) as any,
          },
        });
      } catch (err) {
        console.error("Failed to write activity log:", err);
      }
    },

    async listForWorkspace(workspaceId: string, limit = 20) {
      return prisma.activityLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    },
  },
};
