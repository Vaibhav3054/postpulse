export interface PlanLimits {
  code: string;
  name: string;
  priceMonthly: number;
  currency: string;
  currencySymbol: string;
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
    currency: "INR",
    currencySymbol: "₹",
    maxWorkspaces: 1,
    maxSocialAccounts: 3,
    maxScheduledPostsPerMonth: 30,
    maxStorageMb: 500,
    maxTeamMembers: 1,
    features: [
      "1 Workspace / Brand",
      "Connect up to 3 Social Accounts",
      "30 Scheduled Posts / Month",
      "Unified Composer & Live Feed Mockups",
      "Visual Content Calendar",
      "500 MB Media Storage",
    ],
  },
  pro: {
    code: "pro",
    name: "Pro Creator",
    priceMonthly: 799,
    currency: "INR",
    currencySymbol: "₹",
    maxWorkspaces: 3,
    maxSocialAccounts: 10,
    maxScheduledPostsPerMonth: 99999,
    maxStorageMb: 5120,
    maxTeamMembers: 3,
    features: [
      "3 Workspaces / Brands",
      "Connect up to 10 Social Accounts",
      "Unlimited Scheduled Posts",
      "Multi-Account Custom Overrides",
      "5 GB Cloud Media Storage",
      "3 Team Member Seats",
      "IST Peak Hours Quick Scheduling",
    ],
  },
  creator: {
    code: "creator",
    name: "Pro Creator",
    priceMonthly: 799,
    currency: "INR",
    currencySymbol: "₹",
    maxWorkspaces: 3,
    maxSocialAccounts: 10,
    maxScheduledPostsPerMonth: 99999,
    maxStorageMb: 5120,
    maxTeamMembers: 3,
    features: [
      "3 Workspaces / Brands",
      "Connect up to 10 Social Accounts",
      "Unlimited Scheduled Posts",
      "Multi-Account Custom Overrides",
      "5 GB Cloud Media Storage",
      "3 Team Member Seats",
      "IST Peak Hours Quick Scheduling",
    ],
  },
  agency: {
    code: "agency",
    name: "Agency",
    priceMonthly: 2999,
    currency: "INR",
    currencySymbol: "₹",
    maxWorkspaces: 50,
    maxSocialAccounts: 50,
    maxScheduledPostsPerMonth: 99999,
    maxStorageMb: 25600,
    maxTeamMembers: 15,
    features: [
      "Unlimited / 50 Workspaces for Clients",
      "Connect up to 50 Social Accounts",
      "Unlimited Scheduled Posts",
      "Client-Level Data Isolation",
      "25 GB High-Speed Media Storage",
      "15 Team Members & Role Permissions",
      "Priority Queue Publishing & Audit Logs",
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
