import { requireServerWorkspaceAccess } from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";

export const instant = false;

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { user: session, workspace, membership } = await requireServerWorkspaceAccess(workspaceSlug);

  const workspaces = await db.workspaces.listForUser(session.id);
  const currentWsFormatted = {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    planId: workspace.plan?.code || "pro",
    planName: workspace.plan?.name || "Pro Plan",
    role: membership.role,
  };

  return (
    <AppShell
      currentWorkspace={currentWsFormatted}
      workspaces={workspaces}
      user={session}
    >
      {children}
    </AppShell>
  );
}
