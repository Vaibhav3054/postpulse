import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) {
    return NextResponse.json({ user: null }, { status: auth.error.status });
  }

  const user = await db.users.findById(auth.user.id);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const workspaces = await db.workspaces.listForUser(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      systemRole: user.systemRole,
    },
    workspaces,
  });
}
