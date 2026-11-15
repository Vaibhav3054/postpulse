import { db } from "../db";
import { getSocialProvider } from "../social-providers/registry";
import { decryptToken } from "../crypto";
import { SocialPlatformType } from "../social-providers/types";

export interface PublishJobData {
  postId: string;
  targetId: string;
  workspaceId: string;
  socialAccountId: string;
  platform: SocialPlatformType;
  attempt: number;
}

/**
 * Core publishing executor.
 * Called either by the BullMQ worker or directly by the cron dispatcher.
 */
export async function executePublishJob(jobData: PublishJobData): Promise<void> {
  const { postId, targetId, socialAccountId, platform, attempt } = jobData;
  const startTime = Date.now();

  const post = await db.posts.findById(postId);
  if (!post) {
    console.error(`[Worker] Post ${postId} not found. Aborting job.`);
    return;
  }

  const target = post.platformTargets.find((t) => t.id === targetId);
  if (!target) {
    console.error(`[Worker] Target ${targetId} not found in post ${postId}. Aborting.`);
    return;
  }

  // Idempotency check: if target is already published, skip to prevent double posting
  if (target.status === "PUBLISHED") {
    console.log(`[Worker] Target ${targetId} already published. Skipping for idempotency.`);
    return;
  }

  const account = await db.socialAccounts.findById(socialAccountId);
  if (!account || !account.isActive) {
    await db.posts.updateTargetStatus(targetId, "FAILED", {
      errorMessage: "Connected social account is missing or deactivated.",
    });
    await db.attempts.record({
      postPlatformTargetId: targetId,
      attemptNumber: attempt,
      status: "FAILED",
      errorMessage: "Connected social account is missing or deactivated.",
      durationMs: Date.now() - startTime,
    });
    return;
  }

  try {
    const provider = getSocialProvider(platform);
    const accessToken = decryptToken(account.accessTokenEncrypted);

    // Extract caption and media
    const caption = target.customCaption || post.commonCaption;
    const mediaUrls = post.media.map((m) => m.publicUrl);
    const primaryMediaType = post.media.length > 0 ? post.media[0].mediaType : undefined;

    console.log(`[Worker] Executing publish to ${platform} for target ${targetId}...`);

    const result = await provider.publishPost(accessToken, account.platformAccountId, {
      caption,
      mediaUrls,
      mediaType: primaryMediaType,
      platformPayload: target.platformPayload as Record<string, unknown>,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      await db.posts.updateTargetStatus(targetId, "PUBLISHED", {
        externalPostId: result.externalPostId,
        externalPostUrl: result.externalPostUrl,
      });

      await db.attempts.record({
        postPlatformTargetId: targetId,
        attemptNumber: attempt,
        status: "PUBLISHED",
        responseSummary: {
          externalPostId: result.externalPostId,
          externalPostUrl: result.externalPostUrl,
        },
        durationMs,
      });

      await db.activity.log({
        workspaceId: post.workspaceId,
        userId: post.createdByUserId,
        action: "POST_PUBLISHED",
        entityType: "POST",
        entityId: post.id,
        metadata: {
          platform,
          externalPostId: result.externalPostId,
          externalPostUrl: result.externalPostUrl,
        },
      });

      console.log(`[Worker] Successfully published to ${platform}! External ID: ${result.externalPostId}`);
    } else {
      await db.posts.updateTargetStatus(targetId, "FAILED", {
        errorMessage: result.errorMessage,
        errorDetails: result.errorDetails,
      });

      await db.attempts.record({
        postPlatformTargetId: targetId,
        attemptNumber: attempt,
        status: "FAILED",
        errorMessage: result.errorMessage,
        errorDetails: result.errorDetails,
        durationMs,
      });

      console.error(`[Worker] Failed publishing to ${platform}: ${result.errorMessage}`);
    }
  } catch (err: unknown) {
    const error = err as Error;
    const durationMs = Date.now() - startTime;
    await db.posts.updateTargetStatus(targetId, "FAILED", {
      errorMessage: error.message || "Unexpected worker error",
    });

    await db.attempts.record({
      postPlatformTargetId: targetId,
      attemptNumber: attempt,
      status: "FAILED",
      errorMessage: error.message,
      durationMs,
    });
    console.error(`[Worker] Exception during publish:`, error);
  }
}

/**
 * Idempotent Dispatcher.
 * Scans for due scheduled posts and triggers execution for each platform target.
 */
export async function dispatchDueScheduledPosts(): Promise<{ processedCount: number }> {
  const duePosts = await db.posts.findDuePosts();
  let processedCount = 0;

  for (const post of duePosts) {
    console.log(`[Dispatcher] Found due post ${post.id} scheduled for ${post.scheduledAt}`);
    
    // Atomically transition status to PUBLISHING to avoid duplicate polling
    await db.posts.update(post.id, { status: "PUBLISHING" });

    for (const target of post.platformTargets) {
      if (target.status === "PENDING" || target.status === "FAILED") {
        await executePublishJob({
          postId: post.id,
          targetId: target.id,
          workspaceId: post.workspaceId,
          socialAccountId: target.socialAccountId,
          platform: target.platform,
          attempt: 1,
        });
        processedCount++;
      }
    }
  }

  return { processedCount };
}
