import { NextRequest, NextResponse } from "next/server";
import {
  getAdminCookieOptions,
  recordAdminAuditLog,
  requireAdminApiSession,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (!auth.error) {
    await recordAdminAuditLog({
      admin: auth.admin,
      action: "ADMIN_LOGOUT",
      entityType: "ADMIN_SESSION",
      entityId: auth.admin.id,
      req,
    }).catch(() => {});
  }

  const cookieOptions = getAdminCookieOptions();
  const res = NextResponse.json({ success: true });
  res.cookies.set(cookieOptions.name, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
