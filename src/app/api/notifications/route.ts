import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation";

const markReadSchema = z.object({
  workspaceId: z.string().trim().min(1),
  notificationId: z.string().trim().min(1).optional(),
  markAll: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { workspaceId, isRead: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, markReadSchema);
  if (parsed.error) return parsed.error;

  const { workspaceId, notificationId, markAll } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  if (markAll) {
    await prisma.notification.updateMany({
      where: { workspaceId, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  if (notificationId) {
    await prisma.notification.updateMany({
      where: { id: notificationId, workspaceId },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: "Provide notificationId or markAll: true." },
    { status: 400 }
  );
}
