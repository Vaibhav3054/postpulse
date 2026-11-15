import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { ContentComposer } from "@/components/composer/ContentComposer";

export default async function ComposerPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await db.workspaces.findBySlug(workspaceSlug);
  if (!workspace) notFound();

  const accounts = await db.socialAccounts.listForWorkspace(workspace.id);
  const media = await db.mediaAssets.listForWorkspace(workspace.id);

  const formattedAccounts = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    platformUsername: a.platformUsername || a.platformAccountId,
    platformDisplayName: a.platformDisplayName || a.platformUsername || a.platformAccountId,
    avatarUrl: a.avatarUrl || undefined,
  }));

  const formattedMedia = media.map((m) => ({
    id: m.id,
    fileName: m.fileName,
    publicUrl: m.publicUrl,
    mediaType: m.mediaType,
  }));

  return (
    <>
      <Header title="Content Composer" workspaceSlug={workspace.slug} />
      <ContentComposer
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        accounts={formattedAccounts}
        mediaLibrary={formattedMedia}
      />
    </>
  );
}
