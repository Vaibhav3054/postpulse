import { SocialProvider, ConnectResult, PublishPostPayload, PublishResult, AccountDetails } from "./types";

export class InstagramProvider implements SocialProvider {
  readonly platform = "INSTAGRAM" as const;

  getAuthUrl(state: string, redirectUri: string): string {
    const appId = process.env.META_APP_ID;
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || !appId || appId === "mock_meta_app_id";

    if (isMock) {
      return `/api/social-accounts/oauth/mock-callback?platform=INSTAGRAM&state=${encodeURIComponent(state)}`;
    }

    const scopes = [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ].join(",");

    return `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&response_type=code`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<ConnectResult> {
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || code.startsWith("mock_");

    if (isMock) {
      const randomId = Math.floor(100000 + Math.random() * 900000);
      return {
        account: {
          platformAccountId: `ig_${randomId}`,
          platformUsername: `creator_brand_${randomId}`,
          platformDisplayName: `Brand Creator Studio`,
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          metadata: {
            accountType: "BUSINESS",
            followers: 12500 + Math.floor(Math.random() * 5000),
            mediaCount: 42,
          },
        },
        accessToken: `ig_live_token_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days long-lived token
        scopes: ["instagram_basic", "instagram_content_publish"],
      };
    }

    // Official Meta Graph API token exchange
    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;

    const tokenRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error?.message || "Failed to exchange Meta code for token");
    }

    // Exchange short-lived token for 60-day long-lived token
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();
    const finalToken = longLivedData.access_token || tokenData.access_token;

    // Fetch Instagram Business Account linked to user's Facebook Pages
    const accountsRes = await fetch(
      `https://graph.facebook.com/v20.0/me/accounts?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${finalToken}`
    );
    const accountsData = await accountsRes.json();

    const page = accountsData.data?.find((p: { instagram_business_account?: { id: string } }) => p.instagram_business_account);
    if (!page?.instagram_business_account) {
      throw new Error(
        "No eligible Instagram Professional (Business/Creator) account found linked to your Facebook Pages. Please convert your Instagram account to Professional and link it to a Page."
      );
    }

    const igAccount = page.instagram_business_account;

    return {
      account: {
        platformAccountId: igAccount.id,
        platformUsername: igAccount.username,
        platformDisplayName: igAccount.name || igAccount.username,
        avatarUrl: igAccount.profile_picture_url,
        metadata: { accountType: "BUSINESS" },
      },
      accessToken: finalToken,
      tokenExpiresAt: new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000),
      scopes: ["instagram_basic", "instagram_content_publish"],
    };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    if (accessToken.startsWith("mock_")) return true;
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/me?access_token=${accessToken}`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt?: Date }> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (
      process.env.MOCK_SOCIAL_PROVIDERS === "true" ||
      refreshToken.startsWith("mock_") ||
      refreshToken.startsWith("ig_live_token_") ||
      !appId ||
      !appSecret
    ) {
      return {
        accessToken: refreshToken,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };
    }

    const res = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        appId
      )}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(
        refreshToken
      )}`
    );
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.error?.message || "Failed to refresh Meta Instagram access token");
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    };
  }

  async publishPost(
    accessToken: string,
    accountId: string,
    payload: PublishPostPayload
  ): Promise<PublishResult> {
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || accessToken.startsWith("mock_");

    if (isMock) {
      // Simulate realistic network latency
      await new Promise((resolve) => setTimeout(resolve, 600));
      const mockPostId = `ig_post_${Date.now()}`;
      return {
        success: true,
        externalPostId: mockPostId,
        externalPostUrl: `https://www.instagram.com/p/${mockPostId.substring(8)}/`,
      };
    }

    try {
      if (!payload.mediaUrls || payload.mediaUrls.length === 0) {
        throw new Error("Instagram requires at least one image or video to publish a post.");
      }

      const mediaUrl = payload.mediaUrls[0];
      const isVideo = payload.mediaType === "VIDEO" || mediaUrl.match(/\.(mp4|mov)/i);

      // Step 1: Create IG Container
      const containerEndpoint = `https://graph.facebook.com/v20.0/${accountId}/media`;
      const containerParams = new URLSearchParams({
        caption: payload.caption,
        access_token: accessToken,
      });

      if (isVideo) {
        containerParams.append("media_type", "REELS");
        containerParams.append("video_url", mediaUrl);
      } else {
        containerParams.append("image_url", mediaUrl);
      }

      const containerRes = await fetch(containerEndpoint, {
        method: "POST",
        body: containerParams,
      });
      const containerData = await containerRes.json();

      if (!containerRes.ok || !containerData.id) {
        return {
          success: false,
          errorMessage: containerData.error?.message || "Failed to create Instagram media container",
          errorDetails: containerData.error,
        };
      }

      const creationId = containerData.id;

      // For videos, poll status until container is ready
      if (isVideo) {
        let attempts = 0;
        let isReady = false;
        while (attempts < 10 && !isReady) {
          await new Promise((r) => setTimeout(r, 3000));
          const statusRes = await fetch(
            `https://graph.facebook.com/v20.0/${creationId}?fields=status_code&access_token=${accessToken}`
          );
          const statusData = await statusRes.json();
          if (statusData.status_code === "FINISHED") {
            isReady = true;
          } else if (statusData.status_code === "ERROR") {
            return {
              success: false,
              errorMessage: "Instagram media container failed during processing",
              errorDetails: statusData,
            };
          }
          attempts++;
        }
      }

      // Step 2: Publish Container
      const publishEndpoint = `https://graph.facebook.com/v20.0/${accountId}/media_publish`;
      const publishRes = await fetch(publishEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: accessToken,
        }),
      });

      const publishData = await publishRes.json();
      if (!publishRes.ok || !publishData.id) {
        return {
          success: false,
          errorMessage: publishData.error?.message || "Failed to publish Instagram container",
          errorDetails: publishData.error,
        };
      }

      return {
        success: true,
        externalPostId: publishData.id,
        externalPostUrl: `https://www.instagram.com/p/${publishData.id}/`,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        errorMessage: error.message || "Unknown error publishing to Instagram",
      };
    }
  }

  async getAccountDetails(accessToken: string, accountId: string): Promise<AccountDetails> {
    if (accessToken.startsWith("mock_")) {
      return {
        platformAccountId: accountId,
        platformUsername: "creator_brand",
        platformDisplayName: "Brand Creator Studio",
      };
    }

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${accountId}?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${accessToken}`
    );
    const data = await res.json();
    return {
      platformAccountId: data.id,
      platformUsername: data.username,
      platformDisplayName: data.name || data.username,
      avatarUrl: data.profile_picture_url,
      metadata: {
        followers: data.followers_count,
        mediaCount: data.media_count,
      },
    };
  }
}
