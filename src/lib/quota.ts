export interface PlanLimits {
  code: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
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
    priceAnnual: 0,
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
      "500 MB Cloud Media Storage",
    ],
  },
  pro: {
    code: "pro",
    name: "Pro Creator",
    priceMonthly: 799,
    priceAnnual: 7990,
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
    priceAnnual: 7990,
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
  business: {
    code: "business",
    name: "Business",
    priceMonthly: 1999,
    priceAnnual: 19990,
    currency: "INR",
    currencySymbol: "₹",
    maxWorkspaces: 10,
    maxSocialAccounts: 25,
    maxScheduledPostsPerMonth: 300,
    maxStorageMb: 10240,
    maxTeamMembers: 5,
    features: [
      "10 Workspaces / Brands",
      "Connect up to 25 Social Accounts",
      "300 Scheduled Posts / Month",
      "10 GB Cloud Media Storage",
      "5 Team Member Seats",
    ],
  },
  agency: {
    code: "agency",
    name: "Agency",
    priceMonthly: 2999,
    priceAnnual: 29990,
    currency: "INR",
    currencySymbol: "₹",
    maxWorkspaces: 50,
    maxSocialAccounts: 50,
    maxScheduledPostsPerMonth: 99999,
    maxStorageMb: 25600,
    maxTeamMembers: 15,
    features: [
      "Up to 50 Workspaces for Clients",
      "Connect up to 50 Social Accounts",
      "Unlimited Scheduled Posts",
      "Client-Level Data Isolation",
      "25 GB High-Speed Media Storage",
      "15 Team Members & Role Permissions",
      "Priority Queue Publishing & Audit Logs",
    ],
  },
};

export interface DbSubscriptionPlanLike {
  code?: string | null;
  name?: string | null;
  maxWorkspaces?: number | null;
  maxSocialAccounts?: number | null;
  maxScheduledPostsPerMonth?: number | null;
  maxStorageMb?: number | null;
  maxTeamMembers?: number | null;
  priceCents?: number | null;
}

/**
 * Canonical plan resolver: safely maps a Prisma SubscriptionPlan relation (never raw UUID planId)
 * into a unified PlanLimits object, preferring DB-configured limits when present.
 */
export function resolveWorkspacePlan(
  dbPlan?: DbSubscriptionPlanLike | null,
  fallbackCode?: string | null
): PlanLimits {
  const rawCode = (dbPlan?.code || fallbackCode || "free").toLowerCase().trim();
  const normalizedCode = rawCode === "creator" ? "pro" : rawCode;
  const base =
    SUBSCRIPTION_PLANS[normalizedCode] ||
    SUBSCRIPTION_PLANS[rawCode] ||
    SUBSCRIPTION_PLANS.free;

  if (!dbPlan) return base;

  return {
    ...base,
    code: base.code,
    name: dbPlan.name || base.name,
    maxWorkspaces:
      typeof dbPlan.maxWorkspaces === "number" && dbPlan.maxWorkspaces > 0
        ? dbPlan.maxWorkspaces
        : base.maxWorkspaces,
    maxSocialAccounts:
      typeof dbPlan.maxSocialAccounts === "number" && dbPlan.maxSocialAccounts > 0
        ? dbPlan.maxSocialAccounts
        : base.maxSocialAccounts,
    maxScheduledPostsPerMonth:
      typeof dbPlan.maxScheduledPostsPerMonth === "number" && dbPlan.maxScheduledPostsPerMonth > 0
        ? dbPlan.maxScheduledPostsPerMonth
        : base.maxScheduledPostsPerMonth,
    maxStorageMb:
      typeof dbPlan.maxStorageMb === "number" && dbPlan.maxStorageMb > 0
        ? dbPlan.maxStorageMb
        : base.maxStorageMb,
    maxTeamMembers:
      typeof dbPlan.maxTeamMembers === "number" && dbPlan.maxTeamMembers > 0
        ? dbPlan.maxTeamMembers
        : base.maxTeamMembers,
  };
}

export class QuotaExceededError extends Error {
  resource: string;
  limit: number;
  current: number;
  planCode: string;

  constructor(resource: string, limit: number, current: number, planCode: string) {
    super(
      `Quota limit reached for ${resource}. Limit: ${limit}, Current: ${current} on ${planCode} plan.`
    );
    this.name = "QuotaExceededError";
    this.resource = resource;
    this.limit = limit;
    this.current = current;
    this.planCode = planCode;
  }
}
