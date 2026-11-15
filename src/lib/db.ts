import {
  mockStore,
  DBUser,
  DBWorkspace,
  DBWorkspaceMember,
  DBSocialAccount,
  DBMediaAsset,
  DBPost,
  DBPostPlatformTarget,
  DBPublishAttempt,
  DBActivityLog,
} from "./mock-data";
import { SUBSCRIPTION_PLANS, QuotaExceededError } from "./quota";

export const db = {
  users: {
    async findByEmail(email: string): Promise<DBUser | null> {
      const user = mockStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      return user || null;
    },

    async findById(id: string): Promise<DBUser | null> {
      const user = mockStore.users.find((u) => u.id === id);
      return user || null;
    },

    async create(data: {
      email: string;
      passwordHash: string;
      fullName?: string;
      avatarUrl?: string;
    }): Promise<DBUser> {
      const newUser: DBUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        fullName: data.fullName || "User",
        avatarUrl: data.avatarUrl || "",
        systemRole: "USER",
        createdAt: new Date(),
      };
      mockStore.users.push(newUser);

      // Auto-create initial default personal workspace
      const workspaceSlug = newUser.fullName.toLowerCase().replace(/[^a-z0-9]/g, "-") || "my-brand";
      const newWs: DBWorkspace = {
        id: `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: `${newUser.fullName}'s Brand`,
        slug: `${workspaceSlug}-${Math.random().toString(36).substring(2, 5)}`,
        ownerId: newUser.id,
        planId: "free",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockStore.workspaces.push(newWs);

      mockStore.members.push({
        id: `mem_${Date.now()}`,
        workspaceId: newWs.id,
        userId: newUser.id,
        role: "OWNER",
        joinedAt: new Date(),
      });

      return newUser;
    },
  },

  workspaces: {
    async listForUser(userId: string): Promise<(DBWorkspace & { role: string; planName: string })[]> {
      const memberships = mockStore.members.filter((m) => m.userId === userId);
      const wsIds = memberships.map((m) => m.workspaceId);
      
      return mockStore.workspaces
        .filter((w) => wsIds.includes(w.id))
        .map((w) => {
          const mem = memberships.find((m) => m.workspaceId === w.id);
          const plan = SUBSCRIPTION_PLANS[w.planId] || SUBSCRIPTION_PLANS.free;
          return {
            ...w,
            role: mem?.role || "MEMBER",
            planName: plan.name,
          };
        });
    },

    async findBySlug(slug: string): Promise<DBWorkspace | null> {
      const ws = mockStore.workspaces.find((w) => w.slug === slug);
      return ws || null;
    },

    async findById(id: string): Promise<DBWorkspace | null> {
      const ws = mockStore.workspaces.find((w) => w.id === id);
      return ws || null;
    },

    async checkMembership(workspaceId: string, userId: string): Promise<DBWorkspaceMember | null> {
      const mem = mockStore.members.find(
        (m) => m.workspaceId === workspaceId && m.userId === userId
      );
      return mem || null;
    },

    async create(data: { name: string; slug: string; ownerId: string }): Promise<DBWorkspace> {
      // Check user's plan limit for workspaces
      const userWorkspaces = mockStore.workspaces.filter((w) => w.ownerId === data.ownerId);
      // Determine highest plan user has
      const currentCount = userWorkspaces.length;
      if (currentCount >= 50) {
        throw new QuotaExceededError("workspaces", 50, currentCount, "agency");
      }

      let uniqueSlug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (mockStore.workspaces.some((w) => w.slug === uniqueSlug)) {
        uniqueSlug = `${uniqueSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      const newWs: DBWorkspace = {
        id: `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: data.name,
        slug: uniqueSlug,
        ownerId: data.ownerId,
        planId: "free",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockStore.workspaces.push(newWs);

      mockStore.members.push({
        id: `mem_${Date.now()}`,
        workspaceId: newWs.id,
        userId: data.ownerId,
        role: "OWNER",
        joinedAt: new Date(),
      });

      return newWs;
    },

    async update(id: string, data: { name?: string; slug?: string; planId?: string }): Promise<DBWorkspace> {
      const idx = mockStore.workspaces.findIndex((w) => w.id === id);
      if (idx === -1) throw new Error("Workspace not found");
      
      const updated = {
        ...mockStore.workspaces[idx],
        ...data,
        updatedAt: new Date(),
      };
      mockStore.workspaces[idx] = updated;
      return updated;
    },

    async delete(id: string): Promise<void> {
      mockStore.workspaces = mockStore.workspaces.filter((w) => w.id !== id);
      mockStore.members = mockStore.members.filter((m) => m.workspaceId !== id);
      mockStore.socialAccounts = mockStore.socialAccounts.filter((s) => s.workspaceId !== id);
      mockStore.posts = mockStore.posts.filter((p) => p.workspaceId !== id);
      mockStore.mediaAssets = mockStore.mediaAssets.filter((m) => m.workspaceId !== id);
    },
  },

  socialAccounts: {
    async listForWorkspace(workspaceId: string): Promise<DBSocialAccount[]> {
      return mockStore.socialAccounts.filter((s) => s.workspaceId === workspaceId && s.isActive);
    },

    async findById(id: string): Promise<DBSocialAccount | null> {
      const acc = mockStore.socialAccounts.find((s) => s.id === id);
      return acc || null;
    },

    async create(data: Omit<DBSocialAccount, "id" | "createdAt" | "updatedAt">): Promise<DBSocialAccount> {
      const ws = await db.workspaces.findById(data.workspaceId);
      const plan = SUBSCRIPTION_PLANS[ws?.planId || "free"];
      const currentCount = mockStore.socialAccounts.filter(
        (s) => s.workspaceId === data.workspaceId && s.isActive
      ).length;

      if (currentCount >= plan.maxSocialAccounts) {
        throw new QuotaExceededError("social_accounts", plan.maxSocialAccounts, currentCount, plan.code);
      }

      // Check if this exact platform account is already connected to this workspace
      const existingIdx = mockStore.socialAccounts.findIndex(
        (s) =>
          s.workspaceId === data.workspaceId &&
          s.platform === data.platform &&
          s.platformAccountId === data.platformAccountId
      );

      if (existingIdx !== -1) {
        mockStore.socialAccounts[existingIdx] = {
          ...mockStore.socialAccounts[existingIdx],
          ...data,
          isActive: true,
          updatedAt: new Date(),
        };
        return mockStore.socialAccounts[existingIdx];
      }

      const newAccount: DBSocialAccount = {
        ...data,
        id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockStore.socialAccounts.push(newAccount);
      return newAccount;
    },

    async disconnect(id: string): Promise<void> {
      const acc = mockStore.socialAccounts.find((s) => s.id === id);
      if (acc) {
        acc.isActive = false;
        acc.updatedAt = new Date();
      }
    },
  },

  mediaAssets: {
    async listForWorkspace(workspaceId: string): Promise<DBMediaAsset[]> {
      return mockStore.mediaAssets
        .filter((m) => m.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async findById(id: string): Promise<DBMediaAsset | null> {
      const asset = mockStore.mediaAssets.find((m) => m.id === id);
      return asset || null;
    },

    async create(data: Omit<DBMediaAsset, "id" | "createdAt">): Promise<DBMediaAsset> {
      const newAsset: DBMediaAsset = {
        ...data,
        id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date(),
      };
      mockStore.mediaAssets.push(newAsset);
      return newAsset;
    },

    async delete(id: string): Promise<void> {
      mockStore.mediaAssets = mockStore.mediaAssets.filter((m) => m.id !== id);
    },
  },

  posts: {
    async listForWorkspace(
      workspaceId: string,
      options?: { status?: string; platform?: string }
    ): Promise<(DBPost & { media: DBMediaAsset[] })[]> {
      let filtered = mockStore.posts.filter((p) => p.workspaceId === workspaceId);

      if (options?.status && options.status !== "ALL") {
        filtered = filtered.filter((p) => p.status.toUpperCase() === options.status?.toUpperCase());
      }

      if (options?.platform && options.platform !== "ALL") {
        filtered = filtered.filter((p) =>
          p.platformTargets.some(
            (t) => t.platform.toUpperCase() === options.platform?.toUpperCase()
          )
        );
      }

      return filtered
        .sort((a, b) => {
          const dateA = a.scheduledAt || a.createdAt;
          const dateB = b.scheduledAt || b.createdAt;
          return dateB.getTime() - dateA.getTime();
        })
        .map((p) => {
          const media = mockStore.mediaAssets.filter((m) => p.mediaAssetIds.includes(m.id));
          return {
            ...p,
            media,
          };
        });
    },

    async findById(id: string): Promise<(DBPost & { media: DBMediaAsset[] }) | null> {
      const post = mockStore.posts.find((p) => p.id === id);
      if (!post) return null;
      const media = mockStore.mediaAssets.filter((m) => post.mediaAssetIds.includes(m.id));
      return {
        ...post,
        media,
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
        platform: "INSTAGRAM" | "FACEBOOK" | "YOUTUBE" | "LINKEDIN";
        customCaption?: string;
        platformPayload?: Record<string, unknown>;
      }[];
    }): Promise<DBPost> {
      const ws = await db.workspaces.findById(data.workspaceId);
      const plan = SUBSCRIPTION_PLANS[ws?.planId || "free"];

      if (data.status === "SCHEDULED") {
        const scheduledThisMonth = mockStore.posts.filter(
          (p) => p.workspaceId === data.workspaceId && p.status === "SCHEDULED"
        ).length;
        if (scheduledThisMonth >= plan.maxScheduledPostsPerMonth) {
          throw new QuotaExceededError(
            "scheduled_posts",
            plan.maxScheduledPostsPerMonth,
            scheduledThisMonth,
            plan.code
          );
        }
      }

      const postId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const platformTargets: DBPostPlatformTarget[] = data.targets.map((t) => ({
        id: `target_${postId}_${t.socialAccountId}`,
        postId,
        socialAccountId: t.socialAccountId,
        platform: t.platform,
        customCaption: t.customCaption,
        platformPayload: t.platformPayload || {},
        status: data.status === "PUBLISHED" ? "PUBLISHED" : "PENDING",
        publishedAt: data.status === "PUBLISHED" ? new Date() : undefined,
        idempotencyKey: `${postId}_${t.socialAccountId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const newPost: DBPost = {
        id: postId,
        workspaceId: data.workspaceId,
        createdByUserId: data.createdByUserId,
        status: data.status,
        commonCaption: data.commonCaption,
        scheduledAt: data.scheduledAt,
        timezone: data.timezone || "UTC",
        publishedAt: data.status === "PUBLISHED" ? new Date() : undefined,
        mediaAssetIds: data.mediaAssetIds || [],
        platformTargets,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.posts.unshift(newPost);
      return newPost;
    },

    async update(id: string, data: Partial<DBPost>): Promise<DBPost> {
      const idx = mockStore.posts.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error("Post not found");

      const updated = {
        ...mockStore.posts[idx],
        ...data,
        updatedAt: new Date(),
      };
      mockStore.posts[idx] = updated;
      return updated;
    },

    async delete(id: string): Promise<void> {
      mockStore.posts = mockStore.posts.filter((p) => p.id !== id);
    },

    async findDuePosts(): Promise<DBPost[]> {
      const now = new Date();
      return mockStore.posts.filter(
        (p) => p.status === "SCHEDULED" && p.scheduledAt && new Date(p.scheduledAt) <= now
      );
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
    ): Promise<void> {
      for (const post of mockStore.posts) {
        const target = post.platformTargets.find((t) => t.id === targetId);
        if (target) {
          target.status = status;
          target.publishedAt = status === "PUBLISHED" ? new Date() : undefined;
          if (details?.externalPostId) target.externalPostId = details.externalPostId;
          if (details?.externalPostUrl) target.externalPostUrl = details.externalPostUrl;
          if (details?.errorMessage) target.errorMessage = details.errorMessage;
          if (details?.errorDetails) target.errorDetails = details.errorDetails;
          target.updatedAt = new Date();

          // Re-aggregate post status
          const allStatuses = post.platformTargets.map((t) => t.status);
          const allPublished = allStatuses.every((s) => s === "PUBLISHED");
          const anyPublished = allStatuses.some((s) => s === "PUBLISHED");
          const anyFailed = allStatuses.some((s) => s === "FAILED");

          if (allPublished) {
            post.status = "PUBLISHED";
            post.publishedAt = new Date();
          } else if (anyPublished && anyFailed) {
            post.status = "PARTIALLY_PUBLISHED";
          } else if (anyFailed) {
            post.status = "FAILED";
          }
          post.updatedAt = new Date();
          break;
        }
      }
    },
  },

  attempts: {
    async record(data: Omit<DBPublishAttempt, "id" | "executedAt">): Promise<DBPublishAttempt> {
      const attempt: DBPublishAttempt = {
        ...data,
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        executedAt: new Date(),
      };
      mockStore.attempts.push(attempt);
      return attempt;
    },

    async listForTarget(targetId: string): Promise<DBPublishAttempt[]> {
      return mockStore.attempts.filter((a) => a.postPlatformTargetId === targetId);
    },
  },

  activity: {
    async log(data: Omit<DBActivityLog, "id" | "createdAt">): Promise<void> {
      mockStore.logs.unshift({
        ...data,
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date(),
      });
    },

    async listForWorkspace(workspaceId: string, limit = 20): Promise<DBActivityLog[]> {
      return mockStore.logs
        .filter((l) => l.workspaceId === workspaceId)
        .slice(0, limit);
    },
  },
};
