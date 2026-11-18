import { SocialProvider, ConnectResult, PublishPostPayload, PublishResult, AccountDetails } from "./types";

export class LinkedInProvider implements SocialProvider {
  readonly platform = "LINKEDIN" as const;

  getAuthUrl(state: string, redirectUri: string): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || !clientId || clientId === "mock_linkedin_client_id";

    if (isMock) {
      return `/api/social-accounts/oauth/mock-callback?platform=LINKEDIN&state=${encodeURIComponent(state)}`;
    }

    const scopes = [
      "openid",
      "profile",
      "email",
      "w_member_social",
      ...(process.env.LINKEDIN_ENABLE_ORG_SCOPES === "true"
        ? ["r_organization_social", "w_organization_social", "rw_organization_admin"]
        : []),
    ].join(" ");

    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<ConnectResult> {
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || code.startsWith("mock_");

    if (isMock) {
      const randomId = Math.floor(100000 + Math.random() * 900000);
      return {
        account: {
          platformAccountId: `urn:li:person:${randomId}`,
          platformUsername: `brand-founder-${randomId}`,
          platformDisplayName: `Brand Founder & Executive`,
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          metadata: {
            headline: "Founder, Product Architect & SaaS Builder",
            connections: 4800,
          },
        },
        accessToken: `li_token_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        scopes: ["openid", "profile", "w_member_social"],
      };
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || "Failed to exchange LinkedIn code");
    }

    // Fetch user profile info via OpenID userinfo
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = await profileRes.json();

    const personUrn = `urn:li:person:${profileData.sub}`;

    return {
      account: {
        platformAccountId: personUrn,
        platformUsername: profileData.name || profileData.email,
        platformDisplayName: profileData.name || "LinkedIn User",
        avatarUrl: profileData.picture,
        metadata: {
          email: profileData.email,
        },
      },
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      scopes: ["openid", "profile", "w_member_social"],
    };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    if (accessToken.startsWith("mock_")) return true;
    try {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt?: Date }> {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (
      process.env.MOCK_SOCIAL_PROVIDERS === "true" ||
      refreshToken.startsWith("mock_") ||
      refreshToken.startsWith("li_token_") ||
      !clientId ||
      !clientSecret
    ) {
      return {
        accessToken: refreshToken,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };
    }

    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description || "Failed to refresh LinkedIn OAuth token");
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
      const mockPostUrn = `urn:li:share:${Math.floor(10000000 + Math.random() * 90000000)}`;
      return {
        success: true,
        externalPostId: mockPostUrn,
        externalPostUrl: `https://www.linkedin.com/feed/update/${mockPostUrn}`,
      };
    }

    try {
      // Upload attached image(s) via LinkedIn's official Digital Media Register + PUT Upload API
      const uploadedMedia: Array<{ status: "READY"; media: string }> = [];
      const candidateUrls = (payload.mediaUrls || []).filter(Boolean).slice(0, 9);

      for (const mediaUrl of candidateUrls) {
        const assetRes = await fetch(mediaUrl);
        if (!assetRes.ok) {
          throw new Error(`Failed to download attached media for LinkedIn upload (HTTP ${assetRes.status})`);
        }
        const contentType = (assetRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
        if (!contentType.startsWith("image/")) {
          // Skip non-image assets for feedshare-image recipe
          continue;
        }
        const imageBytes = await assetRes.arrayBuffer();

        const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: accountId,
              serviceRelationships: [
                {
                  relationshipType: "OWNER",
                  identifier: "urn:li:userGeneratedContent",
                },
              ],
            },
          }),
        });

        const registerData = await registerRes.json().catch(() => ({}));
        const uploadUrl =
          registerData?.value?.uploadMechanism?.[
            "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
          ]?.uploadUrl;
        const assetUrn = registerData?.value?.asset;

        if (!registerRes.ok || !uploadUrl || !assetUrn) {
          throw new Error(
            registerData?.message || "Failed to register image upload with LinkedIn API"
          );
        }

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": contentType,
          },
          body: imageBytes,
        });

        if (!putRes.ok) {
          throw new Error(`LinkedIn rejected image binary upload (HTTP ${putRes.status})`);
        }

        uploadedMedia.push({ status: "READY", media: assetUrn });
      }

      // Official LinkedIn UGC Post API
      const shareContent: Record<string, unknown> = {
        shareCommentary: {
          text: payload.caption,
        },
        shareMediaCategory: uploadedMedia.length > 0 ? "IMAGE" : "NONE",
      };
      if (uploadedMedia.length > 0) {
        shareContent.media = uploadedMedia;
      }

      const requestBody: Record<string, unknown> = {
        author: accountId,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": shareContent,
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json().catch(() => ({}));
      const postId = data?.id || res.headers.get("x-restli-id");
      if (!res.ok || !postId) {
        return {
          success: false,
          errorMessage: data?.message || `Failed to publish to LinkedIn (HTTP ${res.status})`,
          errorDetails: data,
        };
      }

      return {
        success: true,
        externalPostId: postId,
        externalPostUrl: `https://www.linkedin.com/feed/update/${postId}`,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        errorMessage: error.message || "Unknown error publishing to LinkedIn",
      };
    }
  }

  async getAccountDetails(accessToken: string, accountId: string): Promise<AccountDetails> {
    if (accessToken.startsWith("mock_")) {
      return {
        platformAccountId: accountId,
        platformUsername: "executive_brand",
        platformDisplayName: "Executive Brand",
      };
    }

    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return {
      platformAccountId: accountId,
      platformUsername: data.name,
      platformDisplayName: data.name,
      avatarUrl: data.picture,
    };
  }
}
