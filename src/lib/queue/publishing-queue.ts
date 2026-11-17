import crypto from "crypto";
import { PostStatus, TargetPublishStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { db } from "../db";
import { getSocialProvider } from "../social-providers/registry";
import { decryptToken, encryptToken } from "../crypto";
import { SocialPlatformType } from "../social-providers/types";
import { createWorkspaceNotification } from "../notifications";
import { expireElapsedSubscriptions } from "../billing/subscription-service";

export interface PublishJobData {
  postId: string;
  targetId: string;
  workspaceId: string;
  socialAccountId: string;
  platform: SocialPlatformType;
  attempt?: number;
  forceManualRetry?: boolean;
}

export interface PublishExecutionOutcome {
  targetId: string;
  status: "PUBLISHED" | "FAILED" | "RETRY_SCHEDULED" | "SKIPPED";
  reason?: string;
  externalPostId?: string;
  isMockPublish?: boolean;
}

export interface DispatchSummary {
  workerId: string;
  scannedPosts: number;
  processedCount: number;
  publishedCount: number;
  failedCount: number;
  retryingCount: number;
  skippedCount: number;
  recoveredStaleLocks: number;
  hasMore: boolean;
  durationMs: number;
}

const STALE_LOCK_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh if expiring within 5 minutes
const RETRY_BACKOFF_MS = [
  2 * 60 * 1000, // Retry 1: 2 minutes
  5 * 60 * 1000, // Retry 2: 5 minutes
  15 * 60 * 1000, // Retry 3: 15 minutes
];
const MAX_BATCH_TARGETS = 20; // Keeps each Netlify Scheduled Function run safely under 30s
const MAX_CONCURRENCY = 4;

function isMockModeAccount(accessToken: string, metadata: Record<string, unknown>): boolean {
  if (metadata?.isMock === true) return true;
  if (process.env.MOCK_SOCIAL_PROVIDERS !== "false") {
    return true;
  }
  const lower = accessToken.toLowerCase();
  const mockPrefixes = [
    "mock_",
    "gbp_mock_",
    "gbp_access_token_",
    "gbp_refreshed_token_",
    "yt_mock_",
    "yt_token_",
    "ig_mock_",
    "ig_token_",
    "fb_mock_",
    "fb_token_",
    "li_mock_",
    "li_token_",
  ];
  return mockPrefixes.some((p) => lower.startsWith(p));
}

/**
 * Recalculates the master Post.status from all its PostPlatformTargets.
 */
export async function recalculatePostStatus(postId: string): Promise<PostStatus> {
  const allTargets = await prisma.postPlatformTarget.findMany({
    where: { postId },
  });

  if (allTargets.length === 0) return PostStatus.FAILED;

  const allPublished = allTargets.every((t) => t.status === TargetPublishStatus.PUBLISHED);
  const anyPublishing = allTargets.some((t) => t.status === TargetPublishStatus.PUBLISHING);
  const anyPending = allTargets.some((t) => t.status === TargetPublishStatus.PENDING);
  const anyPublished = allTargets.some((t) => t.status === TargetPublishStatus.PUBLISHED);
  const anyFailed = allTargets.some((t) => t.status === TargetPublishStatus.FAILED);
  const anyRetrying = allTargets.some(
    (t) =>
      t.status === TargetPublishStatus.FAILED &&
      t.nextRetryAt !== null &&
      t.retryCount < t.maxRetries
  );

  let newStatus: PostStatus = PostStatus.PUBLISHING;
  if (allPublished) {
    newStatus = PostStatus.PUBLISHED;
  } else if (anyPublishing || anyPending || anyRetrying) {
    newStatus = PostStatus.PUBLISHING;
  } else if (anyPublished && anyFailed) {
    newStatus = PostStatus.PARTIALLY_PUBLISHED;
  } else if (anyFailed) {
    newStatus = PostStatus.FAILED;
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: newStatus,
      publishedAt:
        newStatus === PostStatus.PUBLISHED || newStatus === PostStatus.PARTIALLY_PUBLISHED
          ? new Date()
          : undefined,
    },
  });

  return newStatus;
}

/**
 * Marks a social account as needing re-authorization in metadata without deleting it.
 */
async function flagAccountNeedsReauth(
  socialAccountId: string,
  reason: string
): Promise<void> {
  const existing = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } });
  if (!existing) return;
  const meta = (existing.metadata as Record<string, unknown>) || {};
  await prisma.socialAccount.update({
    where: { id: socialAccountId },
    data: {
      metadata: {
        ...meta,
        needsReauth: true,
        reauthReason: reason,
        reauthFlaggedAt: new Date().toISOString(),
      } as object,
    },
  });
}

/**
 * Core atomic publishing executor.
 * Guarantees zero duplicate publishing via PostgreSQL conditional locking and externalPostId guards.
 * Automatically detects & refreshes expired OAuth tokens before calling providers.
 */
export async function executePublishJob(
  jobData: PublishJobData,
  workerId: string = `worker_${crypto.randomBytes(4).toString("hex")}`
): Promise<PublishExecutionOutcome> {
  const { postId, targetId, platform, forceManualRetry } = jobData;
  const startTime = Date.now();
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_LOCK_MS);

  // 1. Atomic Lock Acquisition: only ONE worker/process can transition this target to PUBLISHING.
  //    Also enforces `externalPostId: null` so a previously confirmed publish can NEVER be duplicated.
  const acquired = await prisma.postPlatformTarget.updateMany({
    where: {
      id: targetId,
      postId,
      externalPostId: null,
      status: { in: [TargetPublishStatus.PENDING, TargetPublishStatus.FAILED] },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleCutoff } }],
    },
    data: {
      status: TargetPublishStatus.PUBLISHING,
      lockedAt: now,
      lockOwner: workerId,
      nextRetryAt: null,
    },
  });

  if (acquired.count === 0) {
    return {
      targetId,
      status: "SKIPPED",
      reason: "Already published, currently locked by another worker, or not eligible",
    };
  }

  const target = await prisma.postPlatformTarget.findUnique({
    where: { id: targetId },
    include: {
      post: {
        include: {
          media: {
            include: { mediaAsset: true },
            orderBy: { displayOrder: "asc" },
          },
        },
      },
      socialAccount: true,
    },
  });

  if (!target || !target.post) {
    return { targetId, status: "SKIPPED", reason: "Target or post not found after lock" };
  }

  const attemptNumber = jobData.attempt ?? target.retryCount + 1;
  const post = target.post;
  const account = target.socialAccount;

  const failTarget = async (opts: {
    errorCode: string;
    errorMessage: string;
    errorDetails?: Record<string, unknown>;
    permanent: boolean;
    notificationType?: "PUBLISH_FAILED" | "TOKEN_EXPIRED" | "ACCOUNT_DISCONNECTED";
  }): Promise<PublishExecutionOutcome> => {
    const durationMs = Date.now() - startTime;
    const nextRetryCount = target.retryCount + 1;
    const canRetry = !opts.permanent && nextRetryCount < target.maxRetries;
    const backoffMs =
      RETRY_BACKOFF_MS[Math.min(nextRetryCount - 1, RETRY_BACKOFF_MS.length - 1)] ||
      15 * 60 * 1000;
    const nextRetryAt = canRetry ? new Date(Date.now() + backoffMs) : null;

    await prisma.postPlatformTarget.update({
      where: { id: targetId },
      data: {
        status: TargetPublishStatus.FAILED,
        retryCount: opts.permanent ? target.maxRetries : nextRetryCount,
        nextRetryAt,
        lockedAt: null,
        lockOwner: null,
        errorMessage: opts.errorMessage,
        errorDetails: {
          ...(opts.errorDetails || {}),
          errorCode: opts.errorCode,
          permanent: opts.permanent,
          attemptNumber,
        } as object,
      },
    });

    await db.attempts.record({
      postPlatformTargetId: targetId,
      attemptNumber,
      status: "FAILED",
      requestSummary: {
        platform,
        socialAccountId: target.socialAccountId,
        idempotencyKey: target.idempotencyKey,
        workerId,
      },
      errorCode: opts.errorCode,
      errorMessage: opts.errorMessage,
      errorDetails: opts.errorDetails,
      durationMs,
    });

    await recalculatePostStatus(postId);

    // Send failure / expired-token / disconnected notification on permanent failure or final retry exhaustion
    if (!canRetry) {
      const notifType = opts.notificationType || "PUBLISH_FAILED";
      const platformLabel = platform.replace("_", " ");
      const title =
        notifType === "TOKEN_EXPIRED"
          ? `${platformLabel} Authorization Expired`
          : notifType === "ACCOUNT_DISCONNECTED"
            ? `${platformLabel} Account Disconnected`
            : `Scheduled Post Failed on ${platformLabel}`;

      await createWorkspaceNotification({
        workspaceId: post.workspaceId,
        userId: post.createdByUserId,
        type: notifType,
        title,
        message: `${opts.errorMessage} (Post: "${(post.commonCaption || "Untitled").slice(0, 80)}")`,
        entityType: "POST",
        entityId: post.id,
        metadata: {
          platform,
          targetId,
          socialAccountId: target.socialAccountId,
          errorCode: opts.errorCode,
          attemptNumber,
        },
        sendEmailToAdmins: true,
      }).catch((notifErr) => {
        console.error("[Publish Notification Error]", notifErr);
      });
    }

    return {
      targetId,
      status: canRetry ? "RETRY_SCHEDULED" : "FAILED",
      reason: opts.errorMessage,
    };
  };

  // 2. Verify Connected Account Status
  if (!account || !account.isActive) {
    return failTarget({
      errorCode: "ACCOUNT_DISCONNECTED",
      errorMessage:
        "The connected social account has been disconnected or deactivated. Please reconnect the account and retry.",
      permanent: true,
      notificationType: "ACCOUNT_DISCONNECTED",
    });
  }

  try {
    const provider = getSocialProvider(platform);
    let accessToken = decryptToken(account.accessTokenEncrypted);

    // 3. Expired / Expiring OAuth Token Detection & Automatic Refresh
    const isExpiredOrExpiring =
      account.tokenExpiresAt !== null &&
      account.tokenExpiresAt.getTime() <= Date.now() + TOKEN_REFRESH_BUFFER_MS;

    if (isExpiredOrExpiring) {
      if (!account.refreshTokenEncrypted) {
        await flagAccountNeedsReauth(
          account.id,
          "Access token expired and no refresh token is stored."
        );
        return failTarget({
          errorCode: "TOKEN_EXPIRED",
          errorMessage:
            "OAuth access token has expired and cannot be refreshed automatically. Please reauthorize your account in Social Accounts.",
          permanent: true,
          notificationType: "TOKEN_EXPIRED",
        });
      }

      try {
        const refreshToken = decryptToken(account.refreshTokenEncrypted);
        const refreshed = await provider.refreshToken(refreshToken);

        if (!refreshed?.accessToken) {
          throw new Error("Provider returned an empty access token during refresh.");
        }

        accessToken = refreshed.accessToken;
        const newExpiresAt =
          refreshed.expiresAt || new Date(Date.now() + 55 * 60 * 1000);

        const existingMeta = (account.metadata as Record<string, unknown>) || {};
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessTokenEncrypted: encryptToken(accessToken),
            tokenExpiresAt: newExpiresAt,
            metadata: {
              ...existingMeta,
              needsReauth: false,
              lastTokenRefreshedAt: new Date().toISOString(),
            } as object,
          },
        });

        await db.activity.log({
          workspaceId: post.workspaceId,
          userId: post.createdByUserId || undefined,
          action: "OAUTH_TOKEN_REFRESHED",
          entityType: "SOCIAL_ACCOUNT",
          entityId: account.id,
          metadata: { platform, newExpiresAt: newExpiresAt.toISOString() },
        });
      } catch (refreshErr: unknown) {
        const rErr = refreshErr as Error;
        await flagAccountNeedsReauth(
          account.id,
          `Token refresh failed: ${rErr.message}`
        );
        return failTarget({
          errorCode: "TOKEN_EXPIRED",
          errorMessage: `Automatic OAuth token refresh failed (${rErr.message}). Please reauthorize your ${platform} account.`,
          errorDetails: { refreshError: rErr.message },
          permanent: true,
          notificationType: "TOKEN_EXPIRED",
        });
      }
    }

    // 4. Execute Official Provider Publish
    const caption = target.customCaption || post.commonCaption || "";
    const mediaUrls = post.media.map((m) => m.mediaAsset.publicUrl);
    const primaryMediaType = post.media.length > 0 ? post.media[0].mediaAsset.mediaType : undefined;
    const mockPublish = isMockModeAccount(
      accessToken,
      (account.metadata as Record<string, unknown>) || {}
    );

    const result = await provider.publishPost(accessToken, account.platformAccountId, {
      caption,
      mediaUrls,
      mediaType: primaryMediaType,
      platformPayload: (target.platformPayload as Record<string, unknown>) || {},
    });

    const durationMs = Date.now() - startTime;

    // 5. Strict Provider Confirmation: NEVER mark PUBLISHED unless provider confirms success AND returns an externalPostId
    if (result.success && result.externalPostId) {
      await prisma.postPlatformTarget.update({
        where: { id: targetId },
        data: {
          status: TargetPublishStatus.PUBLISHED,
          externalPostId: result.externalPostId,
          externalPostUrl: result.externalPostUrl || null,
          publishedAt: new Date(),
          lockedAt: null,
          lockOwner: null,
          nextRetryAt: null,
          errorMessage: null,
          isMockPublish: mockPublish,
        },
      });

      await db.attempts.record({
        postPlatformTargetId: targetId,
        attemptNumber,
        status: "PUBLISHED",
        requestSummary: {
          platform,
          socialAccountId: account.id,
          idempotencyKey: target.idempotencyKey,
          mediaCount: mediaUrls.length,
          timezone: post.timezone,
          workerId,
          forceManualRetry: Boolean(forceManualRetry),
        },
        responseSummary: {
          externalPostId: result.externalPostId,
          externalPostUrl: result.externalPostUrl,
          isMockPublish: mockPublish,
        },
        durationMs,
      });

      await recalculatePostStatus(postId);

      await db.activity.log({
        workspaceId: post.workspaceId,
        userId: post.createdByUserId || undefined,
        action: mockPublish ? "POST_PUBLISHED_MOCK" : "POST_PUBLISHED",
        entityType: "POST",
        entityId: post.id,
        metadata: {
          platform,
          externalPostId: result.externalPostId,
          externalPostUrl: result.externalPostUrl,
          isMockPublish: mockPublish,
        },
      });

      return {
        targetId,
        status: "PUBLISHED",
        externalPostId: result.externalPostId,
        isMockPublish: mockPublish,
      };
    }

    // Provider returned failure or failed to return an externalPostId confirmation
    const errMsg =
      result.errorMessage ||
      "Provider did not confirm publication with a valid external post ID.";
    const lowerErr = errMsg.toLowerCase();
    const isAuthError =
      lowerErr.includes("unauthorized") ||
      lowerErr.includes("token expired") ||
      lowerErr.includes("invalid oauth") ||
      lowerErr.includes("permissions") ||
      lowerErr.includes("401");

    if (isAuthError) {
      await flagAccountNeedsReauth(account.id, errMsg);
    }

    return failTarget({
      errorCode: isAuthError ? "TOKEN_EXPIRED" : "PROVIDER_PUBLISH_FAILED",
      errorMessage: errMsg,
      errorDetails: result.errorDetails,
      permanent: isAuthError,
      notificationType: isAuthError ? "TOKEN_EXPIRED" : "PUBLISH_FAILED",
    });
  } catch (err: unknown) {
    const error = err as Error;
    return failTarget({
      errorCode: "WORKER_EXCEPTION",
      errorMessage: error.message || "Unexpected publishing engine error",
      permanent: false,
      notificationType: "PUBLISH_FAILED",
    });
  }
}

/**
 * Runs tasks with bounded concurrency to stay fast and safe inside Netlify serverless timeouts.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Automated 24/7 Idempotent Publishing Dispatcher.
 * 1. Recovers any stale PUBLISHING locks (> 5 min old).
 * 2. Scans due SCHEDULED posts (UTC scheduledAt <= now) AND due retry targets (nextRetryAt <= now).
 * 3. Executes targets with atomic locks & bounded concurrency (keeps Netlify Scheduled Function < 30s).
 */
export async function dispatchDueScheduledPosts(): Promise<DispatchSummary> {
  const startedAt = Date.now();
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_LOCK_MS);
  const workerId = `dispatch_${crypto.randomBytes(4).toString("hex")}`;

  // Step 0: Automatically expire elapsed paid & complimentary subscriptions back to Free 24/7
  await expireElapsedSubscriptions().catch((expErr) => {
    console.error("[Dispatcher] Subscription expiry sweep failed:", expErr);
  });

  // Step 1: Recover targets stuck in PUBLISHING from crashed/timed-out workers
  const staleRecovery = await prisma.postPlatformTarget.updateMany({
    where: {
      status: TargetPublishStatus.PUBLISHING,
      externalPostId: null,
      lockedAt: { lt: staleCutoff },
    },
    data: {
      status: TargetPublishStatus.FAILED,
      lockedAt: null,
      lockOwner: null,
      nextRetryAt: now,
      errorMessage: "Recovered from timed-out worker lock; queued for automatic retry.",
    },
  });

  // Step 2: Find due scheduled posts (UTC scheduledAt <= now)
  const dueScheduledPosts = await prisma.post.findMany({
    where: {
      status: PostStatus.SCHEDULED,
      scheduledAt: { lte: now },
    },
    include: {
      platformTargets: {
        where: {
          status: TargetPublishStatus.PENDING,
          externalPostId: null,
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: MAX_BATCH_TARGETS,
  });

  // Atomically mark scanned due posts as PUBLISHING so overlapping polls don't double-scan them
  const duePostIds = dueScheduledPosts.map((p) => p.id);
  if (duePostIds.length > 0) {
    await prisma.post.updateMany({
      where: {
        id: { in: duePostIds },
        status: PostStatus.SCHEDULED,
      },
      data: { status: PostStatus.PUBLISHING },
    });
  }

  // Step 3: Find due automatic retry targets
  const dueRetryTargets = await prisma.postPlatformTarget.findMany({
    where: {
      status: TargetPublishStatus.FAILED,
      externalPostId: null,
      nextRetryAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleCutoff } }],
    },
    include: {
      post: { select: { id: true, workspaceId: true } },
    },
    orderBy: { nextRetryAt: "asc" },
    take: MAX_BATCH_TARGETS,
  });

  // Deduplicate target work items and enforce per-run batch limit
  const jobMap = new Map<string, PublishJobData>();

  for (const post of dueScheduledPosts) {
    for (const t of post.platformTargets) {
      if (jobMap.size >= MAX_BATCH_TARGETS) break;
      jobMap.set(t.id, {
        postId: post.id,
        targetId: t.id,
        workspaceId: post.workspaceId,
        socialAccountId: t.socialAccountId,
        platform: t.platform,
        attempt: t.retryCount + 1,
      });
    }
  }

  for (const t of dueRetryTargets) {
    if (jobMap.size >= MAX_BATCH_TARGETS) break;
    if (t.retryCount >= t.maxRetries) continue;
    if (!jobMap.has(t.id)) {
      jobMap.set(t.id, {
        postId: t.post.id,
        targetId: t.id,
        workspaceId: t.post.workspaceId,
        socialAccountId: t.socialAccountId,
        platform: t.platform,
        attempt: t.retryCount + 1,
      });
    }
  }

  const jobs = Array.from(jobMap.values());
  const outcomes = await runWithConcurrency(jobs, MAX_CONCURRENCY, (job) =>
    executePublishJob(job, workerId)
  );

  let publishedCount = 0;
  let failedCount = 0;
  let retryingCount = 0;
  let skippedCount = 0;

  for (const o of outcomes) {
    if (o.status === "PUBLISHED") publishedCount++;
    else if (o.status === "FAILED") failedCount++;
    else if (o.status === "RETRY_SCHEDULED") retryingCount++;
    else skippedCount++;
  }

  // Check if more due work remains (for optional Background Function chaining)
  const remainingDuePosts = await prisma.post.count({
    where: { status: PostStatus.SCHEDULED, scheduledAt: { lte: new Date() } },
  });

  return {
    workerId,
    scannedPosts: dueScheduledPosts.length,
    processedCount: publishedCount + failedCount + retryingCount,
    publishedCount,
    failedCount,
    retryingCount,
    skippedCount,
    recoveredStaleLocks: staleRecovery.count,
    hasMore: remainingDuePosts > 0 || jobs.length >= MAX_BATCH_TARGETS,
    durationMs: Date.now() - startedAt,
  };
}
