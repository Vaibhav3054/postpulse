import { SocialProvider, ConnectResult, PublishPostPayload, PublishResult, AccountDetails } from "./types";

export class YouTubeProvider implements SocialProvider {
  readonly platform = "YOUTUBE" as const;

  getAuthUrl(state: string, redirectUri: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || !clientId || clientId === "mock_google_client_id";

    if (isMock) {
      return `/api/social-accounts/oauth/mock-callback?platform=YOUTUBE&state=${encodeURIComponent(state)}`;
    }

    const scopes = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" ");

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(
      scopes
    )}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<ConnectResult> {
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || code.startsWith("mock_");

    if (isMock) {
      const randomId = Math.floor(100000 + Math.random() * 900000);
      return {
        account: {
          platformAccountId: `yt_chan_${randomId}`,
          platformUsername: `BrandChannel_${randomId}`,
          platformDisplayName: `Brand Tech & Media Channel`,
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          metadata: {
            subscribers: 28400,
            videoCount: 64,
          },
        },
        accessToken: `yt_access_token_${Date.now()}`,
        refreshToken: `yt_refresh_token_${Date.now()}`,
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        scopes: [
          "https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly",
        ],
      };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || "Failed to exchange Google OAuth code");
    }

    // Fetch user's YouTube channel
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const channelData = await channelRes.json();

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error("No YouTube channel found for this Google account. Please create a channel first.");
    }

    const channel = channelData.items[0];

    return {
      account: {
        platformAccountId: channel.id,
        platformUsername: channel.snippet.customUrl || channel.snippet.title,
        platformDisplayName: channel.snippet.title,
        avatarUrl: channel.snippet.thumbnails?.default?.url,
        metadata: {
          subscribers: channel.statistics?.subscriberCount,
          videoCount: channel.statistics?.videoCount,
        },
      },
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
    };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    if (accessToken.startsWith("mock_")) return true;
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + accessToken);
      return res.ok;
    } catch {
      return false;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt?: Date }> {
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
      throw new Error(data.error_description || "Failed to refresh Google token");
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async publishPost(
    accessToken: string,
    accountId: string,
    payload: PublishPostPayload
  ): Promise<PublishResult> {
    const isMock = process.env.MOCK_SOCIAL_PROVIDERS === "true" || accessToken.startsWith("mock_");

    if (isMock) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const mockVideoId = `v_${Math.random().toString(36).substring(2, 13)}`;
      return {
        success: true,
        externalPostId: mockVideoId,
        externalPostUrl: `https://www.youtube.com/watch?v=${mockVideoId}`,
      };
    }

    try {
      if (!payload.mediaUrls || payload.mediaUrls.length === 0) {
        throw new Error("YouTube publishing requires a video file.");
      }

      const videoUrl = payload.mediaUrls[0];
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error("Failed to fetch video file from storage.");
      }
      const videoBuffer = await videoResponse.arrayBuffer();

      const title = payload.platformPayload?.title || payload.caption.substring(0, 95) || "Scheduled Video";
      const description = payload.caption;
      const privacyStatus = payload.platformPayload?.privacyStatus || "public";
      const tags = payload.platformPayload?.tags || [];

      // Initiate Resumable Upload
      const initRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": videoBuffer.byteLength.toString(),
            "X-Upload-Content-Type": "video/*",
          },
          body: JSON.stringify({
            snippet: {
              title,
              description,
              tags,
              categoryId: payload.platformPayload?.categoryId || "22",
            },
            status: {
              privacyStatus,
              selfDeclaredMadeForKids: false,
            },
          }),
        }
      );

      if (!initRes.ok) {
        const errorData = await initRes.json();
        return {
          success: false,
          errorMessage: errorData.error?.message || "Failed to initialize YouTube video upload",
          errorDetails: errorData.error,
        };
      }

      const uploadLocation = initRes.headers.get("location");
      if (!uploadLocation) {
        throw new Error("No resumable upload location header returned by YouTube");
      }

      // Stream the video bytes
      const uploadRes = await fetch(uploadLocation, {
        method: "PUT",
        headers: {
          "Content-Type": "video/*",
          "Content-Length": videoBuffer.byteLength.toString(),
        },
        body: videoBuffer,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.id) {
        return {
          success: false,
          errorMessage: uploadData.error?.message || "Failed to upload video bytes to YouTube",
          errorDetails: uploadData.error,
        };
      }

      return {
        success: true,
        externalPostId: uploadData.id,
        externalPostUrl: `https://www.youtube.com/watch?v=${uploadData.id}`,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        errorMessage: error.message || "Unknown error publishing to YouTube",
      };
    }
  }

  async getAccountDetails(accessToken: string, accountId: string): Promise<AccountDetails> {
    if (accessToken.startsWith("mock_")) {
      return {
        platformAccountId: accountId,
        platformUsername: "brand_channel",
        platformDisplayName: "Brand Tech Channel",
      };
    }

    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=" + accountId,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const data = await res.json();
    const item = data.items?.[0];
    return {
      platformAccountId: accountId,
      platformUsername: item?.snippet?.customUrl || item?.snippet?.title || accountId,
      platformDisplayName: item?.snippet?.title || accountId,
      avatarUrl: item?.snippet?.thumbnails?.default?.url,
      metadata: {
        subscribers: item?.statistics?.subscriberCount,
      },
    };
  }
}
