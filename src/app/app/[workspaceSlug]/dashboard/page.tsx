import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await db.workspaces.findBySlug(workspaceSlug);
  if (!workspace) notFound();

  const accounts = await db.socialAccounts.listForWorkspace(workspace.id);
  const posts = await db.posts.listForWorkspace(workspace.id);

  // Format accounts
  const formattedAccounts = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    platformUsername: a.platformUsername || a.platformAccountId,
    platformDisplayName: a.platformDisplayName || a.platformUsername || a.platformAccountId,
    avatarUrl: a.avatarUrl,
  }));

  // Format posts
  const formattedPosts = posts.map((p) => ({
    id: p.id,
    status: p.status,
    commonCaption: p.commonCaption || "",
    scheduledAt: p.scheduledAt?.toISOString(),
    publishedAt: p.publishedAt?.toISOString(),
    timezone: p.timezone,
    media: p.media.map((m) => ({ id: m.id, publicUrl: m.publicUrl })),
    platformTargets: p.platformTargets.map((t) => ({
      id: t.id,
      platform: t.platform,
      status: t.status,
      externalPostUrl: t.externalPostUrl,
      errorMessage: t.errorMessage,
    })),
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <>
      <Header
        title="Dashboard"
        workspaceSlug={workspace.slug}
        connectedCount={accounts.length}
        scheduledCount={posts.filter((p) => p.status === "SCHEDULED").length}
      />
      <DashboardOverview
        workspaceName={workspace.name}
        workspaceSlug={workspace.slug}
        accounts={formattedAccounts}
        posts={formattedPosts}
      />
    </>
  );
}
