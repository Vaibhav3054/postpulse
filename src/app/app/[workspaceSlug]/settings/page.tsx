import { requireServerWorkspaceAccess } from "@/lib/authorization";
import { Header } from "@/components/layout/Header";
import { WorkspaceSettingsView } from "@/components/settings/WorkspaceSettingsView";
import { prisma } from "@/lib/prisma";
import { getRazorpayConfig } from "@/lib/billing/razorpay";
import {
  ensureCanonicalPlans,
  getEffectiveUserSubscription,
} from "@/lib/billing/subscription-service";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { user, workspace, membership } = await requireServerWorkspaceAccess(workspaceSlug);

  const [effective, dbPlans, transactions] = await Promise.all([
    getEffectiveUserSubscription(workspace.ownerId),
    ensureCanonicalPlans(),
    prisma.paymentTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const rzConfig = getRazorpayConfig();

  const serializedSub = effective.subscription
    ? {
        id: effective.subscription.id,
        source: effective.subscription.source,
        billingInterval: effective.subscription.billingInterval,
        status: effective.subscription.status,
        currentPeriodEnd: effective.subscription.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: effective.subscription.cancelAtPeriodEnd,
        isIndefinite: effective.subscription.isIndefinite,
        complimentaryReason: effective.subscription.complimentaryReason,
      }
    : null;

  const serializedTx = transactions.map((tx) => ({
    id: tx.id,
    planCode: tx.planCode,
    billingInterval: tx.billingInterval,
    amountPaise: tx.amountPaise,
    currency: tx.currency,
    status: tx.status,
    invoiceNumber: tx.invoiceNumber,
    razorpayPaymentId: tx.razorpayPaymentId,
    failureReason: tx.failureReason,
    paidAt: tx.paidAt?.toISOString() || null,
    createdAt: tx.createdAt.toISOString(),
  }));

  const catalogPlans = dbPlans.map((p) => ({
    code: p.code,
    name: p.name,
    priceMonthlyInr: p.priceMonthlyInr,
    priceAnnualInr: p.priceAnnualInr,
    maxWorkspaces: p.maxWorkspaces,
    maxSocialAccounts: p.maxSocialAccounts,
    maxScheduledPostsPerMonth: p.maxScheduledPostsPerMonth,
    maxStorageMb: p.maxStorageMb,
    maxTeamMembers: p.maxTeamMembers,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  }));

  return (
    <>
      <Header title="Workspace Settings & Billing" workspaceSlug={workspace.slug} />
      <WorkspaceSettingsView
        workspace={{
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          planId: effective.plan.code,
        }}
        currentPlan={effective.plan}
        role={membership.role}
        activeSubscription={serializedSub}
        catalogPlans={catalogPlans}
        transactions={serializedTx}
        gatewayStatus={{
          isConfigured: rzConfig.isConfigured,
          isTestMode: rzConfig.isTestMode,
        }}
      />
    </>
  );
}
