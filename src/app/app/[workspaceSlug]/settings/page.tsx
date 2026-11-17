import { requireServerWorkspaceAccess } from "@/lib/authorization";
import { resolveWorkspacePlan } from "@/lib/quota";
import { Header } from "@/components/layout/Header";
import { WorkspaceSettingsView } from "@/components/settings/WorkspaceSettingsView";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace, membership } = await requireServerWorkspaceAccess(workspaceSlug);

  const currentPlan = resolveWorkspacePlan(workspace.plan);

  return (
    <>
      <Header title="Workspace Settings & Plans" workspaceSlug={workspace.slug} />
      <WorkspaceSettingsView
        workspace={{
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          planId: currentPlan.code,
        }}
        currentPlan={currentPlan}
        role={membership.role}
      />
    </>
  );
}
