export interface PlanLimits {
  code: string;
  name: string;
  priceMonthly: number;
  maxWorkspaces: number;
  maxSocialAccounts: number;
  maxScheduledPostsPerMonth: number;
  maxStorageMb: number;
  maxTeamMembers: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, PlanLimits> = {
  free: {
    code: "free",
    name: "Free Starter",
    priceMonthly: 0,
    maxWorkspaces: 1,
    maxSocialAccounts: 2,
    maxScheduledPostsPerMonth: 10,
    maxStorageMb: 250,
    maxTeamMembers: 1,
    features: [
      "1 Workspace / Brand",
      "Connect 2 Social Accounts",
      "10 Scheduled Posts / Month",
      "Basic Calendar & Drafts",
      "250 MB Media Storage",
    ],
  },
  creator: {
    code: "creator",
    name: "Creator",
    priceMonthly: 19,
    maxWorkspaces: 3,
    maxSocialAccounts: 6,
    maxScheduledPostsPerMonth: 60,
    maxStorageMb: 2048,
    maxTeamMembers: 2,
    features: [
      "3 Workspaces / Brands",
      "Connect 6 Social Accounts",
      "60 Scheduled Posts / Month",
      "Multi-Account Customization",
      "2 GB Media Storage",
      "2 Team Members",
    ],
  },
  business: {
    code: "business",
    name: "Business",
    priceMonthly: 49,
    maxWorkspaces: 10,
    maxSocialAccounts: 25,
    maxScheduledPostsPerMonth: 300,
    maxStorageMb: 10240,
    maxTeamMembers: 5,
    features: [
      "10 Workspaces / Brands",
      "Connect 25 Social Accounts",
      "300 Scheduled Posts / Month",
      "Priority Queue Publishing",
      "10 GB Media Storage",
      "5 Team Members",
      "Publish Performance History",
    ],
  },
  agency: {
    code: "agency",
    name: "Agency",
    priceMonthly: 129,
    maxWorkspaces: 50,
    maxSocialAccounts: 100,
    maxScheduledPostsPerMonth: 99999,
    maxStorageMb: 51200,
    maxTeamMembers: 20,
    features: [
      "50 Workspaces / Brands",
      "Connect 100 Social Accounts",
      "Unlimited Scheduled Posts",
      "Multi-Tenant Client Isolation",
      "50 GB High-Speed Media Storage",
      "20 Team Members & RBAC Roles",
      "Dedicated Publishing Engine",
    ],
  },
};

export class QuotaExceededError extends Error {
  resource: string;
  limit: number;
  current: number;
  planCode: string;

  constructor(resource: string, limit: number, current: number, planCode: string) {
    super(`Quota limit reached for ${resource}. Limit: ${limit}, Current: ${current} on ${planCode} plan.`);
    this.name = "QuotaExceededError";
    this.resource = resource;
    this.limit = limit;
    this.current = current;
    this.planCode = planCode;
  }
}
