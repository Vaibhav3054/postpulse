import { SocialProvider, ConnectResult, PublishPostPayload, PublishResult, AccountDetails } from "./types";

export class FacebookProvider implements SocialProvider {
  readonly platform = "FACEBOOK" as const;

  getAuthUrl(state: string, redirectUri: string): string {
    const appId = process.env.META_APP_ID;
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || !appId || appId === "mock_meta_app_id";

    if (isMock) {
      return `/api/social-accounts/oauth/mock-callback?platform=FACEBOOK&state=${encodeURIComponent(state)}`;
    }

    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
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
          platformAccountId: `fb_page_${randomId}`,
          platformUsername: `brand_official_${randomId}`,
          platformDisplayName: `Brand Facebook Page`,
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          metadata: {
            pageCategory: "Business & Technology",
            fans: 8400 + Math.floor(Math.random() * 2000),
          },
        },
        accessToken: `fb_page_token_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
      };
    }

    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;

    const tokenRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error?.message || "Failed to exchange Facebook code for token");
    }

    // Get user's managed pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,category,access_token,picture{url}&access_token=${tokenData.access_token}`
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook Pages found. You must be an Admin/Editor of at least one Facebook Page to connect.");
    }

    const page = pagesData.data[0];

    return {
      account: {
        platformAccountId: page.id,
        platformUsername: page.id,
        platformDisplayName: page.name,
        avatarUrl: page.picture?.data?.url,
        metadata: { pageCategory: page.category },
      },
      accessToken: page.access_token,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: ["pages_manage_posts", "pages_read_engagement"],
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
      refreshToken.startsWith("fb_page_token_") ||
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
      throw new Error(data.error?.message || "Failed to refresh Meta Facebook access token");
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
      await new Promise((resolve) => setTimeout(resolve, 500));
      const mockPostId = `fb_post_${Date.now()}`;
      return {
        success: true,
        externalPostId: mockPostId,
        externalPostUrl: `https://facebook.com/${accountId}/posts/${mockPostId}`,
      };
    }

    try {
      const hasMedia = payload.mediaUrls && payload.mediaUrls.length > 0;
      let endpoint: string;
      const params = new URLSearchParams({ access_token: accessToken });

      if (hasMedia) {
        const mediaUrl = payload.mediaUrls[0];
        const isVideo = payload.mediaType === "VIDEO" || mediaUrl.match(/\.(mp4|mov)/i);

        if (isVideo) {
          endpoint = `https://graph-video.facebook.com/v20.0/${accountId}/videos`;
          params.append("description", payload.caption);
          params.append("file_url", mediaUrl);
        } else {
          endpoint = `https://graph.facebook.com/v20.0/${accountId}/photos`;
          params.append("caption", payload.caption);
          params.append("url", mediaUrl);
        }
      } else {
        endpoint = `https://graph.facebook.com/v20.0/${accountId}/feed`;
        params.append("message", payload.caption);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: params,
      });
      const data = await res.json();

      if (!res.ok || (!data.id && !data.post_id)) {
        return {
          success: false,
          errorMessage: data.error?.message || "Failed to publish post to Facebook Page",
          errorDetails: data.error,
        };
      }

      const postId = data.post_id || data.id;
      return {
        success: true,
        externalPostId: postId,
        externalPostUrl: `https://facebook.com/${postId}`,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        errorMessage: error.message || "Unknown error publishing to Facebook",
      };
    }
  }

  async getAccountDetails(accessToken: string, accountId: string): Promise<AccountDetails> {
    if (accessToken.startsWith("mock_")) {
      return {
        platformAccountId: accountId,
        platformUsername: "page_brand",
        platformDisplayName: "Brand Page",
      };
    }

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${accountId}?fields=id,name,category,fan_count,picture{url}&access_token=${accessToken}`
    );
    const data = await res.json();
    return {
      platformAccountId: data.id,
      platformUsername: data.id,
      platformDisplayName: data.name,
      avatarUrl: data.picture?.data?.url,
      metadata: { fans: data.fan_count, category: data.category },
    };
  }
}
