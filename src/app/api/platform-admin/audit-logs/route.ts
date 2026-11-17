import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/platform-admin/audit-logs
 * Read-only, append-only immutable platform administration audit trail.
 * No update or delete endpoints exist.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action")?.trim();
  const limit = Math.min(200, Math.max(10, Number(searchParams.get("limit") || 100)));

  const logs = await prisma.adminAuditLog.findMany({
    where: action && action !== "ALL" ? { action } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ logs });
}
