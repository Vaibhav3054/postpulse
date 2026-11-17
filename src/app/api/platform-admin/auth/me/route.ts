import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  return NextResponse.json({
    admin: {
      id: auth.admin.id,
      email: auth.admin.email,
      fullName: auth.admin.fullName,
      systemRole: auth.admin.systemRole,
    },
  });
}
