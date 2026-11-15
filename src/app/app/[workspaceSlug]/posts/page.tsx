import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { PostsDashboard } from "@/components/posts/PostsDashboard";

export default async function PostsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await db.workspaces.findBySlug(workspaceSlug);
  if (!workspace) notFound();

  const posts = await db.posts.listForWorkspace(workspace.id);

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
      impressions: t.impressions,
      likes: t.likes,
      comments: t.comments,
      shares: t.shares,
      reach: t.reach,
      clicks: t.clicks,
      metricsUpdatedAt: t.metricsUpdatedAt?.toISOString(),
    })),
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <>
      <Header title="Posts Management" workspaceSlug={workspace.slug} />
      <PostsDashboard
        posts={formattedPosts}
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
      />
    </>
  );
}
