import { PrismaClient, SystemRole, WorkspaceRole, SocialPlatform, MediaType, PostStatus, TargetPublishStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  return Buffer.from(secret, "hex");
}

function encryptToken(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

async function main() {
  console.log("Seeding Supabase PostgreSQL database...");

  // 1. Subscription Plans
  const plans = [
    {
      code: "free",
      name: "Free Starter",
      priceCents: 0,
      maxWorkspaces: 1,
      maxSocialAccounts: 2,
      maxScheduledPostsPerMonth: 10,
      maxStorageMb: 250,
      maxTeamMembers: 1,
    },
    {
      code: "creator",
      name: "Creator",
      priceCents: 1900,
      maxWorkspaces: 3,
      maxSocialAccounts: 6,
      maxScheduledPostsPerMonth: 60,
      maxStorageMb: 2048,
      maxTeamMembers: 2,
    },
    {
      code: "business",
      name: "Business",
      priceCents: 4900,
      maxWorkspaces: 10,
      maxSocialAccounts: 25,
      maxScheduledPostsPerMonth: 300,
      maxStorageMb: 10240,
      maxTeamMembers: 5,
    },
    {
      code: "agency",
      name: "Agency",
      priceCents: 12900,
      maxWorkspaces: 50,
      maxSocialAccounts: 100,
      maxScheduledPostsPerMonth: 99999,
      maxStorageMb: 51200,
      maxTeamMembers: 20,
    },
  ];

  const planMap: Record<string, string> = {};
  for (const p of plans) {
    const upserted = await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
    planMap[p.code] = upserted.id;
  }
  console.log("✓ Subscription plans seeded.");

  // 2. Demo User
  const passwordHash = await bcrypt.hash("password123", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@postpulse.io" },
    update: {
      passwordHash,
      fullName: "Alex Rivera",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    create: {
      email: "demo@postpulse.io",
      passwordHash,
      fullName: "Alex Rivera",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      systemRole: SystemRole.USER,
      emailVerified: true,
    },
  });
  console.log("✓ Demo user seeded:", demoUser.email);

  // 3. Workspaces
  const personalWs = await prisma.workspace.upsert({
    where: { slug: "alex-rivera" },
    update: {
      name: "Alex Rivera Brand",
      planId: planMap["creator"],
    },
    create: {
      name: "Alex Rivera Brand",
      slug: "alex-rivera",
      ownerId: demoUser.id,
      planId: planMap["creator"],
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: personalWs.id,
        userId: demoUser.id,
      },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: personalWs.id,
      userId: demoUser.id,
      role: WorkspaceRole.OWNER,
    },
  });

  const clientWs = await prisma.workspace.upsert({
    where: { slug: "aura-creative" },
    update: {
      name: "Aura Creative Studio",
      planId: planMap["business"],
    },
    create: {
      name: "Aura Creative Studio",
      slug: "aura-creative",
      ownerId: demoUser.id,
      planId: planMap["business"],
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: clientWs.id,
        userId: demoUser.id,
      },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: clientWs.id,
      userId: demoUser.id,
      role: WorkspaceRole.OWNER,
    },
  });
  console.log("✓ Workspaces seeded.");

  // 4. Social Accounts
  const igAccount = await prisma.socialAccount.upsert({
    where: {
      workspaceId_platform_platformAccountId: {
        workspaceId: personalWs.id,
        platform: SocialPlatform.INSTAGRAM,
        platformAccountId: "ig_alexrivera",
      },
    },
    update: {},
    create: {
      workspaceId: personalWs.id,
      platform: SocialPlatform.INSTAGRAM,
      platformAccountId: "ig_alexrivera",
      platformUsername: "alexrivera_official",
      platformDisplayName: "Alex Rivera",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      accessTokenEncrypted: encryptToken("mock_ig_token"),
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: ["instagram_basic", "instagram_content_publish"],
      metadata: { accountType: "BUSINESS", followers: 18400 },
    },
  });

  const fbAccount = await prisma.socialAccount.upsert({
    where: {
      workspaceId_platform_platformAccountId: {
        workspaceId: personalWs.id,
        platform: SocialPlatform.FACEBOOK,
        platformAccountId: "fb_alexpage",
      },
    },
    update: {},
    create: {
      workspaceId: personalWs.id,
      platform: SocialPlatform.FACEBOOK,
      platformAccountId: "fb_alexpage",
      platformUsername: "alexriverapage",
      platformDisplayName: "Alex Rivera Creator",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      accessTokenEncrypted: encryptToken("mock_fb_token"),
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: ["pages_manage_posts", "pages_read_engagement"],
      metadata: { fans: 9200 },
    },
  });

  const ytAccount = await prisma.socialAccount.upsert({
    where: {
      workspaceId_platform_platformAccountId: {
        workspaceId: personalWs.id,
        platform: SocialPlatform.YOUTUBE,
        platformAccountId: "yt_alexchannel",
      },
    },
    update: {},
    create: {
      workspaceId: personalWs.id,
      platform: SocialPlatform.YOUTUBE,
      platformAccountId: "yt_alexchannel",
      platformUsername: "AlexRiveraTech",
      platformDisplayName: "Alex Rivera Tech & Design",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      accessTokenEncrypted: encryptToken("mock_yt_token"),
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      metadata: { subscribers: 45200 },
    },
  });

  const liAccount = await prisma.socialAccount.upsert({
    where: {
      workspaceId_platform_platformAccountId: {
        workspaceId: personalWs.id,
        platform: SocialPlatform.LINKEDIN,
        platformAccountId: "li_alexrivera",
      },
    },
    update: {},
    create: {
      workspaceId: personalWs.id,
      platform: SocialPlatform.LINKEDIN,
      platformAccountId: "li_alexrivera",
      platformUsername: "alex-rivera-saas",
      platformDisplayName: "Alex Rivera",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      accessTokenEncrypted: encryptToken("mock_li_token"),
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: ["openid", "profile", "w_member_social"],
      metadata: { headline: "Founder & Creative Technologist" },
    },
  });
  console.log("✓ Social accounts seeded.");

  // 5. Media Assets
  const media1 = await prisma.mediaAsset.upsert({
    where: { storageKey: "workspaces/alex-rivera/minimal-workspace.jpg" },
    update: {},
    create: {
      workspaceId: personalWs.id,
      fileName: "minimal-workspace.jpg",
      storageKey: "workspaces/alex-rivera/minimal-workspace.jpg",
      publicUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop&q=80",
      mediaType: MediaType.IMAGE,
      mimeType: "image/jpeg",
      fileSizeBytes: BigInt(1420000),
      width: 1200,
      height: 800,
    },
  });
  console.log("✓ Media assets seeded.");

  // 6. Posts
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  // Published Post
  const pubPost = await prisma.post.create({
    data: {
      workspaceId: personalWs.id,
      createdByUserId: demoUser.id,
      status: PostStatus.PUBLISHED,
      commonCaption: "Excited to reveal our new creative studio setup! Crafted for maximum focus and seamless video production. 🚀✨",
      publishedAt: threeDaysAgo,
      media: {
        create: {
          mediaAssetId: media1.id,
          displayOrder: 0,
        },
      },
      platformTargets: {
        create: [
          {
            socialAccountId: igAccount.id,
            platform: SocialPlatform.INSTAGRAM,
            status: TargetPublishStatus.PUBLISHED,
            externalPostId: "ig_post_89812491",
            externalPostUrl: "https://instagram.com/p/mock_post_1",
            idempotencyKey: `seed_pub_ig_${Date.now()}`,
            publishedAt: threeDaysAgo,
          },
          {
            socialAccountId: liAccount.id,
            platform: SocialPlatform.LINKEDIN,
            status: TargetPublishStatus.PUBLISHED,
            externalPostId: "li_share_78234812",
            externalPostUrl: "https://linkedin.com/feed/update/urn:li:share:mock_1",
            idempotencyKey: `seed_pub_li_${Date.now()}`,
            publishedAt: threeDaysAgo,
          },
        ],
      },
    },
  });

  // Scheduled Post
  await prisma.post.create({
    data: {
      workspaceId: personalWs.id,
      createdByUserId: demoUser.id,
      status: PostStatus.SCHEDULED,
      commonCaption: "Weekend deep dive into modern multi-tenant SaaS architecture. Here are the 5 lessons we learned building high-throughput scheduling pipelines. 💡",
      scheduledAt: tomorrow,
      timezone: "Asia/Kolkata",
      platformTargets: {
        create: [
          {
            socialAccountId: igAccount.id,
            platform: SocialPlatform.INSTAGRAM,
            status: TargetPublishStatus.PENDING,
            idempotencyKey: `seed_sch_ig_${Date.now()}`,
          },
          {
            socialAccountId: fbAccount.id,
            platform: SocialPlatform.FACEBOOK,
            status: TargetPublishStatus.PENDING,
            idempotencyKey: `seed_sch_fb_${Date.now()}`,
          },
          {
            socialAccountId: liAccount.id,
            platform: SocialPlatform.LINKEDIN,
            status: TargetPublishStatus.PENDING,
            idempotencyKey: `seed_sch_li_${Date.now()}`,
          },
        ],
      },
    },
  });

  console.log("✓ Posts seeded.");
  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
