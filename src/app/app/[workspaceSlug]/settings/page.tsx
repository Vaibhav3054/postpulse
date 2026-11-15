import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUBSCRIPTION_PLANS } from "@/lib/quota";
import { Header } from "@/components/layout/Header";
import { WorkspaceSettingsView } from "@/components/settings/WorkspaceSettingsView";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const workspace = await db.workspaces.findBySlug(workspaceSlug);
  if (!workspace) notFound();

  const membership = await db.workspaces.checkMembership(workspace.id, session.id);
  if (!membership) redirect("/app");

  const currentPlan = SUBSCRIPTION_PLANS[workspace.planId] || SUBSCRIPTION_PLANS.free;

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
