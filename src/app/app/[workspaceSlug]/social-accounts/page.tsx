import { requireServerWorkspaceAccess } from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveWorkspacePlan } from "@/lib/quota";
import { getAllProviderStatuses } from "@/lib/social-providers/oauth-service";
import { Header } from "@/components/layout/Header";
import { SocialAccountsManager } from "@/components/social/SocialAccountsManager";

export default async function SocialAccountsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireServerWorkspaceAccess(workspaceSlug);

  const accounts = await db.socialAccounts.listForWorkspace(workspace.id);
  const plan = resolveWorkspacePlan(workspace.plan);
  const providerStatuses = getAllProviderStatuses();

  const formattedAccounts = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    platformAccountId: a.platformAccountId,
    platformUsername: a.platformUsername || a.platformAccountId,
    platformDisplayName: a.platformDisplayName || a.platformUsername || a.platformAccountId,
    avatarUrl: a.avatarUrl || undefined,
    tokenExpiresAt: a.tokenExpiresAt?.toISOString(),
    scopes: a.scopes || [],
    metadata: (a.metadata as Record<string, unknown>) || undefined,
    isActive: a.isActive,
  }));

  return (
    <>
      <Header title="Social Accounts" workspaceSlug={workspace.slug} />
      <SocialAccountsManager
        accounts={formattedAccounts}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        maxSocialAccounts={plan.maxSocialAccounts}
        providerStatuses={providerStatuses}
      />
    </>
  );
}
