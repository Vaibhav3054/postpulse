import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { ContentCalendar } from "@/components/calendar/ContentCalendar";

export default async function CalendarPage({
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
    })),
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <>
      <Header title="Content Calendar" workspaceSlug={workspace.slug} />
      <ContentCalendar posts={formattedPosts} workspaceSlug={workspace.slug} />
    </>
  );
}
