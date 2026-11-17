import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
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
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const workspace = await db.workspaces.findBySlug(workspaceSlug);
  if (!workspace) {
    notFound();
  }

  const membership = await db.workspaces.checkMembership(workspace.id, session.id);
  if (!membership) {
    redirect("/app");
  }

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
