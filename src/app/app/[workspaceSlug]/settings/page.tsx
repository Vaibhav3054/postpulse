import { requireServerWorkspaceAccess } from "@/lib/authorization";
import { SUBSCRIPTION_PLANS } from "@/lib/quota";
import { Header } from "@/components/layout/Header";
import { WorkspaceSettingsView } from "@/components/settings/WorkspaceSettingsView";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace, membership } = await requireServerWorkspaceAccess(workspaceSlug);

  const currentPlan =
    SUBSCRIPTION_PLANS[workspace.plan?.code || workspace.planId] || SUBSCRIPTION_PLANS.free;

  return (
    <>
      <Header title="Workspace Settings & Plans" workspaceSlug={workspace.slug} />
      <WorkspaceSettingsView
        workspace={{
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          planId: workspace.planId,
        }}
        currentPlan={currentPlan}
        role={membership.role}
      />
    </>
  );
}
