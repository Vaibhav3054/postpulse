import { SocialProvider, SocialPlatformType } from "./types";
import { InstagramProvider } from "./instagram.provider";
import { FacebookProvider } from "./facebook.provider";
import { YouTubeProvider } from "./youtube.provider";
import { LinkedInProvider } from "./linkedin.provider";

const providers: Record<SocialPlatformType, SocialProvider> = {
  INSTAGRAM: new InstagramProvider(),
  FACEBOOK: new FacebookProvider(),
  YOUTUBE: new YouTubeProvider(),
  LINKEDIN: new LinkedInProvider(),
};

export function getSocialProvider(platform: SocialPlatformType): SocialProvider {
  const provider = providers[platform];
  if (!provider) {
    throw new Error(`Unsupported social platform: ${platform}`);
  }
  return provider;
}

export function getAllSocialProviders(): SocialProvider[] {
  return Object.values(providers);
}
