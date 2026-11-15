import { encryptToken } from "./crypto";

export interface DBUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  avatarUrl: string;
  systemRole: "USER" | "SUPERADMIN";
  createdAt: Date;
}

export interface DBWorkspace {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  ownerId: string;
  planId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBWorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: Date;
}

export interface DBSocialAccount {
  id: string;
  workspaceId: string;
  platform: "INSTAGRAM" | "FACEBOOK" | "YOUTUBE" | "LINKEDIN";
  platformAccountId: string;
  platformUsername: string;
  platformDisplayName: string;
  avatarUrl: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string;
  tokenExpiresAt: Date;
  scopes: string[];
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMediaAsset {
  id: string;
  workspaceId: string;
  fileName: string;
  storageKey: string;
  publicUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  mimeType: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  isTemporary: boolean;
  createdAt: Date;
}

export interface DBPostPlatformTarget {
  id: string;
  postId: string;
  socialAccountId: string;
  platform: "INSTAGRAM" | "FACEBOOK" | "YOUTUBE" | "LINKEDIN";
  customCaption?: string;
  platformPayload: Record<string, unknown>;
  status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  externalPostId?: string;
  externalPostUrl?: string;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  publishedAt?: Date;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBPost {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "PARTIALLY_PUBLISHED" | "FAILED";
  commonCaption: string;
  scheduledAt?: Date;
  timezone: string;
  publishedAt?: Date;
  mediaAssetIds: string[];
  platformTargets: DBPostPlatformTarget[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DBPublishAttempt {
  id: string;
  postPlatformTargetId: string;
  attemptNumber: number;
  status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  requestSummary?: Record<string, unknown>;
  responseSummary?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  executedAt: Date;
  durationMs?: number;
}

export interface DBActivityLog {
  id: string;
  workspaceId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// Initial demo user: demo@postpulse.io / password123
// bcrypt hash for "password123":
const DEMO_PASSWORD_HASH = "$2b$10$3euPcmQZ5V2kK3P9C2L67OXnN3gAupCq1QY7kL.d.qXF9wD5tB3k2";

const demoUserId = "usr_demo_1001";
const workspacePersonalId = "ws_personal_101";
const workspaceClientId = "ws_client_102";

const initialUsers: DBUser[] = [
  {
    id: demoUserId,
    email: "demo@postpulse.io",
    passwordHash: DEMO_PASSWORD_HASH,
    fullName: "Alex Rivera",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    systemRole: "USER",
    createdAt: new Date("2026-11-01T10:00:00Z"),
  },
];

const initialWorkspaces: DBWorkspace[] = [
  {
    id: workspacePersonalId,
    name: "Alex Rivera Brand",
    slug: "alex-rivera",
    logoUrl: "",
    ownerId: demoUserId,
    planId: "creator",
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
  },
  {
    id: workspaceClientId,
    name: "Aura Creative Studio",
    slug: "aura-creative",
    logoUrl: "",
    ownerId: demoUserId,
    planId: "business",
    createdAt: new Date("2026-11-05T12:00:00Z"),
    updatedAt: new Date("2026-11-05T12:00:00Z"),
  },
];

const initialMembers: DBWorkspaceMember[] = [
  {
    id: "mem_1",
    workspaceId: workspacePersonalId,
    userId: demoUserId,
    role: "OWNER",
    joinedAt: new Date("2026-11-01T10:00:00Z"),
  },
  {
    id: "mem_2",
    workspaceId: workspaceClientId,
    userId: demoUserId,
    role: "OWNER",
    joinedAt: new Date("2026-11-05T12:00:00Z"),
  },
];

const initialSocialAccounts: DBSocialAccount[] = [
  {
    id: "acc_ig_1",
    workspaceId: workspacePersonalId,
    platform: "INSTAGRAM",
    platformAccountId: "ig_alexrivera",
    platformUsername: "alexrivera_official",
    platformDisplayName: "Alex Rivera",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    accessTokenEncrypted: encryptToken("mock_token_instagram_alex"),
    tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    scopes: ["instagram_basic", "instagram_content_publish"],
    metadata: { accountType: "BUSINESS", followers: 18400 },
    isActive: true,
    createdAt: new Date("2026-11-02T10:00:00Z"),
    updatedAt: new Date("2026-11-02T10:00:00Z"),
  },
  {
    id: "acc_fb_1",
    workspaceId: workspacePersonalId,
    platform: "FACEBOOK",
    platformAccountId: "fb_page_alex",
    platformUsername: "alexriverapage",
    platformDisplayName: "Alex Rivera Creator",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    accessTokenEncrypted: encryptToken("mock_token_facebook_alex"),
    tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    scopes: ["pages_manage_posts", "pages_read_engagement"],
    metadata: { pageCategory: "Digital Creator", fans: 9200 },
    isActive: true,
    createdAt: new Date("2026-11-02T10:05:00Z"),
    updatedAt: new Date("2026-11-02T10:05:00Z"),
  },
  {
    id: "acc_yt_1",
    workspaceId: workspacePersonalId,
    platform: "YOUTUBE",
    platformAccountId: "yt_channel_alex",
    platformUsername: "AlexRiveraTech",
    platformDisplayName: "Alex Rivera Tech & Design",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    accessTokenEncrypted: encryptToken("mock_token_youtube_alex"),
    refreshTokenEncrypted: encryptToken("mock_refresh_token_youtube_alex"),
    tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    scopes: ["https://www.googleapis.com/auth/youtube.upload"],
    metadata: { subscribers: 45200, videosCount: 88 },
    isActive: true,
    createdAt: new Date("2026-11-03T14:00:00Z"),
    updatedAt: new Date("2026-11-03T14:00:00Z"),
  },
  {
    id: "acc_li_1",
    workspaceId: workspacePersonalId,
    platform: "LINKEDIN",
    platformAccountId: "li_alex_rivera",
    platformUsername: "alex-rivera-saas",
    platformDisplayName: "Alex Rivera",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    accessTokenEncrypted: encryptToken("mock_token_linkedin_alex"),
    tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    scopes: ["openid", "profile", "w_member_social"],
    metadata: { headline: "Founder & Creative Technologist" },
    isActive: true,
    createdAt: new Date("2026-11-04T09:00:00Z"),
    updatedAt: new Date("2026-11-04T09:00:00Z"),
  },
];

const initialMediaAssets: DBMediaAsset[] = [
  {
    id: "med_1",
    workspaceId: workspacePersonalId,
    fileName: "minimal-workspace.jpg",
    storageKey: "workspaces/ws_personal_101/demo-workspace.jpg",
    publicUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop&q=80",
    mediaType: "IMAGE",
    mimeType: "image/jpeg",
    fileSizeBytes: 1420000,
    width: 1200,
    height: 800,
    isTemporary: false,
    createdAt: new Date("2026-11-10T08:00:00Z"),
  },
  {
    id: "med_2",
    workspaceId: workspacePersonalId,
    fileName: "creator-studio-setup.jpg",
    storageKey: "workspaces/ws_personal_101/creator-studio.jpg",
    publicUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80",
    mediaType: "IMAGE",
    mimeType: "image/jpeg",
    fileSizeBytes: 2150000,
    width: 1200,
    height: 900,
    isTemporary: false,
    createdAt: new Date("2026-11-12T11:30:00Z"),
  },
];

// Pre-seeded demo posts
const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const twoDaysLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);
const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

const initialPosts: DBPost[] = [
  {
    id: "post_pub_1",
    workspaceId: workspacePersonalId,
    createdByUserId: demoUserId,
    status: "PUBLISHED",
    commonCaption: "Excited to reveal our new creative studio setup! Crafted for maximum focus, deep design work, and seamless video production. What does your dream workspace look like? 🚀✨ #Productivity #CreativeStudio #SaaS",
    timezone: "UTC",
    publishedAt: threeDaysAgo,
    mediaAssetIds: ["med_1"],
    platformTargets: [
      {
        id: "target_1_ig",
        postId: "post_pub_1",
        socialAccountId: "acc_ig_1",
        platform: "INSTAGRAM",
        customCaption: "Excited to reveal our new creative studio setup! 🚀✨\n\nCrafted for maximum focus, deep design work, and seamless video production.\n\n#CreativeStudio #Productivity #DeskSetup #Creator",
        platformPayload: {},
        status: "PUBLISHED",
        externalPostId: "ig_post_89812491",
        externalPostUrl: "https://instagram.com/p/mock_post_1",
        publishedAt: threeDaysAgo,
        idempotencyKey: "post_pub_1_acc_ig_1",
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
      {
        id: "target_1_li",
        postId: "post_pub_1",
        socialAccountId: "acc_li_1",
        platform: "LINKEDIN",
        customCaption: "A calm workspace is the foundation of high-leverage creative output. We just finalized the layout of our dedicated product studio. Here are 3 design principles we followed to eliminate distraction...",
        platformPayload: {},
        status: "PUBLISHED",
        externalPostId: "li_share_78234812",
        externalPostUrl: "https://linkedin.com/feed/update/urn:li:share:mock_1",
        publishedAt: threeDaysAgo,
        idempotencyKey: "post_pub_1_acc_li_1",
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
    ],
    createdAt: new Date(threeDaysAgo.getTime() - 10000),
    updatedAt: threeDaysAgo,
  },
  {
    id: "post_sch_1",
    workspaceId: workspacePersonalId,
    createdByUserId: demoUserId,
    status: "SCHEDULED",
    commonCaption: "Weekend deep dive into modern multi-tenant SaaS architecture. Here are the 5 lessons we learned building high-throughput scheduling pipelines. 💡",
    scheduledAt: tomorrow,
    timezone: "Asia/Kolkata",
    mediaAssetIds: ["med_2"],
    platformTargets: [
      {
        id: "target_2_ig",
        postId: "post_sch_1",
        socialAccountId: "acc_ig_1",
        platform: "INSTAGRAM",
        platformPayload: {},
        status: "PENDING",
        idempotencyKey: "post_sch_1_acc_ig_1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "target_2_fb",
        postId: "post_sch_1",
        socialAccountId: "acc_fb_1",
        platform: "FACEBOOK",
        platformPayload: {},
        status: "PENDING",
        idempotencyKey: "post_sch_1_acc_fb_1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "target_2_li",
        postId: "post_sch_1",
        socialAccountId: "acc_li_1",
        platform: "LINKEDIN",
        platformPayload: {},
        status: "PENDING",
        idempotencyKey: "post_sch_1_acc_li_1",
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "post_sch_2",
    workspaceId: workspacePersonalId,
    createdByUserId: demoUserId,
    status: "SCHEDULED",
    commonCaption: "Mastering video transcoding and direct-to-cloud presigned uploads: Full walkthrough dropping on YouTube this Thursday! 🎬",
    scheduledAt: twoDaysLater,
    timezone: "UTC",
    mediaAssetIds: ["med_1"],
    platformTargets: [
      {
        id: "target_3_yt",
        postId: "post_sch_2",
        socialAccountId: "acc_yt_1",
        platform: "YOUTUBE",
        platformPayload: {
          title: "Building Direct Cloud Uploads with R2 & Next.js",
          privacyStatus: "public",
          categoryId: "28",
        },
        status: "PENDING",
        idempotencyKey: "post_sch_2_acc_yt_1",
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "post_draft_1",
    workspaceId: workspacePersonalId,
    createdByUserId: demoUserId,
    status: "DRAFT",
    commonCaption: "Draft notes: Behind the scenes of our brand redesign. Thinking about sharing the rough Figma sketches next week.",
    timezone: "UTC",
    mediaAssetIds: [],
    platformTargets: [
      {
        id: "target_4_ig",
        postId: "post_draft_1",
        socialAccountId: "acc_ig_1",
        platform: "INSTAGRAM",
        platformPayload: {},
        status: "PENDING",
        idempotencyKey: "post_draft_1_acc_ig_1",
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
];

const initialAttempts: DBPublishAttempt[] = [
  {
    id: "att_1",
    postPlatformTargetId: "target_1_ig",
    attemptNumber: 1,
    status: "PUBLISHED",
    requestSummary: { mediaUrl: "https://images.unsplash.com/..." },
    responseSummary: { id: "ig_post_89812491" },
    executedAt: threeDaysAgo,
    durationMs: 820,
  },
  {
    id: "att_2",
    postPlatformTargetId: "target_1_li",
    attemptNumber: 1,
    status: "PUBLISHED",
    requestSummary: { author: "urn:li:person:..." },
    responseSummary: { id: "li_share_78234812" },
    executedAt: threeDaysAgo,
    durationMs: 640,
  },
];

const initialLogs: DBActivityLog[] = [
  {
    id: "log_1",
    workspaceId: workspacePersonalId,
    userId: demoUserId,
    action: "WORKSPACE_CREATED",
    entityType: "WORKSPACE",
    entityId: workspacePersonalId,
    metadata: { name: "Alex Rivera Brand" },
    createdAt: new Date("2026-11-01T10:00:00Z"),
  },
  {
    id: "log_2",
    workspaceId: workspacePersonalId,
    userId: demoUserId,
    action: "SOCIAL_ACCOUNT_CONNECTED",
    entityType: "SOCIAL_ACCOUNT",
    entityId: "acc_ig_1",
    metadata: { platform: "INSTAGRAM", username: "alexrivera_official" },
    createdAt: new Date("2026-11-02T10:00:00Z"),
  },
  {
    id: "log_3",
    workspaceId: workspacePersonalId,
    userId: demoUserId,
    action: "POST_PUBLISHED",
    entityType: "POST",
    entityId: "post_pub_1",
    metadata: { platforms: ["INSTAGRAM", "LINKEDIN"] },
    createdAt: threeDaysAgo,
  },
];

// In-Memory store class
class MockDataStore {
  users: DBUser[] = [...initialUsers];
  workspaces: DBWorkspace[] = [...initialWorkspaces];
  members: DBWorkspaceMember[] = [...initialMembers];
  socialAccounts: DBSocialAccount[] = [...initialSocialAccounts];
  mediaAssets: DBMediaAsset[] = [...initialMediaAssets];
  posts: DBPost[] = [...initialPosts];
  attempts: DBPublishAttempt[] = [...initialAttempts];
  logs: DBActivityLog[] = [...initialLogs];
}

// Global persistent instance for dev hot-reloads
const globalForStore = global as unknown as { mockStore: MockDataStore | undefined };
export const mockStore = globalForStore.mockStore || new MockDataStore();
if (process.env.NODE_ENV !== "production") {
  globalForStore.mockStore = mockStore;
}
