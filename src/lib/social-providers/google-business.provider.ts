import {
  SocialProvider,
  ConnectResult,
  PublishPostPayload,
  PublishResult,
  AccountDetails,
} from "./types";

export class GoogleBusinessProvider implements SocialProvider {
  readonly platform = "GOOGLE_BUSINESS" as const;

  getAuthUrl(state: string, redirectUri: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const isMock =
      process.env.MOCK_SOCIAL_PROVIDERS === "true" ||
      !clientId ||
      clientId === "mock_google_client_id";

    if (isMock) {
      return `/api/social-accounts/oauth/mock-callback?platform=GOOGLE_BUSINESS&state=${encodeURIComponent(
        state
      )}`;
    }

    const scopes = [
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(
      scopes
    )}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<ConnectResult> {
    const isMock =
      process.env.MOCK_SOCIAL_PROVIDERS === "true" || code.startsWith("mock_");

    if (isMock) {
      const randomId = Math.floor(1000 + Math.random() * 9000);
      return {
        account: {
          platformAccountId: `gbp_loc_${randomId}`,
          platformUsername: `royaldental_${randomId}`,
          platformDisplayName: `Royal Dental & Implant Clinic`,
          avatarUrl:
            "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150&auto=format&fit=crop&q=80",
          metadata: {
            storeCode: `IN-${randomId}`,
            address: "100ft Road, Indiranagar, Bengaluru, Karnataka 560038",
            phone: "+91 98450 12345",
            rating: 4.9,
            reviewCount: 384,
            primaryCategory: "Dental Clinic",
            googleMapsUrl: "https://maps.google.com",
            verified: true,
          },
        },
        accessToken: `gbp_access_token_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        refreshToken: `gbp_refresh_token_${Date.now()}`,
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        scopes: ["https://www.googleapis.com/auth/business.manage"],
      };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(
        tokenData.error_description || "Failed to exchange Google OAuth code for tokens"
      );
    }

    // Fetch accounts and locations from Google My Business Account Management API
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const accountsData = await accountsRes.json();

    if (!accountsData.accounts || accountsData.accounts.length === 0) {
      throw new Error(
        "No Google Business Profile account found for this Google identity. Please ensure your account has access to a verified Business Profile."
      );
    }

    const firstAccount = accountsData.accounts[0];

    return {
      account: {
        platformAccountId: firstAccount.name, // e.g. accounts/123456789
        platformUsername: firstAccount.accountName || "google-business-account",
        platformDisplayName: firstAccount.accountName || "Google Business Profile",
        avatarUrl:
          "https://www.gstatic.com/images/branding/product/2x/google_my_business_48dp.png",
        metadata: {
          accountType: firstAccount.type,
          role: firstAccount.role,
        },
      },
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
      scopes: ["https://www.googleapis.com/auth/business.manage"],
    };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    if (accessToken.startsWith("gbp_access_token_")) return true;

    try {
      const res = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresAt?: Date }> {
    if (refreshToken.startsWith("gbp_refresh_token_")) {
      return {
        accessToken: `gbp_refreshed_token_${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || "Failed to refresh Google Business token");
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
  }

  async publishPost(
    accessToken: string,
    accountId: string,
    payload: PublishPostPayload
  ): Promise<PublishResult> {
    const isMock =
      process.env.MOCK_SOCIAL_PROVIDERS === "true" ||
      accessToken.startsWith("gbp_access_token_") ||
      accessToken.startsWith("gbp_refreshed_token_");

    if (isMock) {
      const randomPostId = Math.floor(100000 + Math.random() * 900000);
      return {
        success: true,
        externalPostId: `gbp_post_${randomPostId}`,
        externalPostUrl: `https://maps.google.com/?cid=mock_gbp_${accountId}_${randomPostId}`,
      };
    }

    try {
      const ctaType = payload.platformPayload?.actionType || "LEARN_MORE";
      const ctaUrl = payload.platformPayload?.actionUrl || "https://google.com";

      const localPostData: Record<string, unknown> = {
        languageCode: "en-IN",
        summary: payload.caption,
        topicType: "STANDARD",
      };

      // Add call to action if not CALL
      if (ctaType !== "CALL" && ctaUrl) {
        localPostData.callToAction = {
          actionType: ctaType,
          url: ctaUrl,
        };
      }

      // Add media if photo URL present
      if (payload.mediaUrls && payload.mediaUrls.length > 0) {
        localPostData.media = [
          {
            mediaFormat: "PHOTO",
            sourceUrl: payload.mediaUrls[0],
          },
        ];
      }

      // Publish to Google My Business API
      const res = await fetch(
        `https://mybusiness.googleapis.com/v4/${accountId}/localPosts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(localPostData),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || "Failed to publish local update to Google Business Profile"
        );
      }

      return {
        success: true,
        externalPostId: data.name,
        externalPostUrl: data.searchUrl || `https://maps.google.com`,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        errorMessage: error.message || "Failed to publish to Google Business Profile",
      };
    }
  }

  async getAccountDetails(
    accessToken: string,
    accountId: string
  ): Promise<AccountDetails> {
    if (accessToken.startsWith("gbp_access_token_")) {
      return {
        platformAccountId: accountId,
        platformUsername: "royaldental_indiranagar",
        platformDisplayName: "Royal Dental & Implant Clinic",
        avatarUrl:
          "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150&auto=format&fit=crop&q=80",
        metadata: {
          rating: 4.9,
          reviews: 384,
          verified: true,
        },
      };
    }

    return {
      platformAccountId: accountId,
      platformUsername: accountId,
      platformDisplayName: "Google Business Profile",
    };
  }
}
