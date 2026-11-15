export type SocialPlatformType = "INSTAGRAM" | "FACEBOOK" | "YOUTUBE" | "LINKEDIN";

export interface AccountDetails {
  platformAccountId: string;
  platformUsername: string;
  platformDisplayName: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectResult {
  account: AccountDetails;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date;
  scopes: string[];
}

export interface PublishPostPayload {
  caption: string;
  mediaUrls: string[];
  mediaType?: "IMAGE" | "VIDEO";
  platformPayload?: {
    // YouTube specific
    title?: string;
    privacyStatus?: "public" | "unlisted" | "private";
    categoryId?: string;
    tags?: string[];
    // Instagram specific
    shareToFeed?: boolean;
    locationId?: string;
    // Facebook specific
    link?: string;
  };
}

export interface PublishResult {
  success: boolean;
  externalPostId?: string;
  externalPostUrl?: string;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
}

export interface SocialProvider {
  readonly platform: SocialPlatformType;

  /**
   * Generates official OAuth 2.0 authorization URL
   */
  getAuthUrl(state: string, redirectUri: string): string;

  /**
   * Exchanges authorization code for tokens and account identity
   */
  handleCallback(code: string, redirectUri: string): Promise<ConnectResult>;

  /**
   * Validates if the stored access token is still active and valid
   */
  validateConnection(accessToken: string): Promise<boolean>;

  /**
   * Refreshes an expired or expiring access token
   */
  refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt?: Date }>;

  /**
   * Publishes content to the official social network API
   */
  publishPost(
    accessToken: string,
    accountId: string,
    payload: PublishPostPayload
  ): Promise<PublishResult>;

  /**
   * Fetches latest profile details and follower counts
   */
  getAccountDetails(accessToken: string, accountId: string): Promise<AccountDetails>;
}
