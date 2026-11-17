import { requireServerWorkspaceAccess } from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveWorkspacePlan } from "@/lib/quota";
import { Header } from "@/components/layout/Header";
import { MediaLibrary } from "@/components/media/MediaLibrary";

export default async function MediaPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireServerWorkspaceAccess(workspaceSlug);

  const media = await db.mediaAssets.listForWorkspace(workspace.id);
  const plan = resolveWorkspacePlan(workspace.plan);

  const formattedMedia = media.map((m) => ({
    id: m.id,
    fileName: m.fileName,
    publicUrl: m.publicUrl,
    mediaType: m.mediaType,
    mimeType: m.mimeType,
    fileSizeBytes: m.fileSizeBytes,
    width: m.width || undefined,
    height: m.height || undefined,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <>
      <Header title="Media Library" workspaceSlug={workspace.slug} />
      <MediaLibrary
        initialMedia={formattedMedia}
        workspaceId={workspace.id}
        maxStorageMb={plan.maxStorageMb}
      />
    </>
  );
}
