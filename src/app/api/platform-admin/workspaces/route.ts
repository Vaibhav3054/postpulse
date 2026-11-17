import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/platform-admin/workspaces
 * Returns administrative workspace metadata ONLY.
 * Strictly excludes private customer posts, media assets, social credentials, and OAuth tokens.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";

  const workspaces = await prisma.workspace.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { owner: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
        },
      },
      plan: {
        select: {
          code: true,
          name: true,
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      createdAt: w.createdAt,
      ownerId: w.owner.id,
      ownerName: w.owner.fullName,
      ownerEmail: w.owner.email,
      ownerStatus: w.owner.status,
      planCode: w.plan.code,
      planName: w.plan.name,
      memberCount: w._count.members,
    })),
  });
}
