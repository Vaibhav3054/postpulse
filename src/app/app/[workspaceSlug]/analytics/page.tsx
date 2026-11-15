import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await db.workspaces.findBySlug(workspaceSlug);
  if (!workspace) notFound();

  const posts = await db.posts.listForWorkspace(workspace.id);
  const logs = await db.activity.listForWorkspace(workspace.id, 25);

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

  const formattedLogs = logs.map((l) => ({
    id: l.id,
    action: l.action,
    entityType: l.entityType,
    createdAt: l.createdAt.toISOString(),
    metadata: l.metadata,
  }));

  return (
    <>
      <Header title="Analytics & Audit Logs" workspaceSlug={workspace.slug} />
      <AnalyticsView
        posts={formattedPosts}
        logs={formattedLogs}
        workspaceName={workspace.name}
      />
    </>
  );
}
