import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUBSCRIPTION_PLANS } from "@/lib/quota";

export async function GET() {
  return NextResponse.json({ plans: Object.values(SUBSCRIPTION_PLANS) });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId, planCode } = await req.json();

    if (!workspaceId || !planCode) {
      return NextResponse.json({ error: "workspaceId and planCode are required." }, { status: 400 });
    }

    if (!SUBSCRIPTION_PLANS[planCode]) {
      return NextResponse.json({ error: "Invalid subscription plan code." }, { status: 400 });
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden: Only the Workspace Owner can change subscription plans." }, { status: 403 });
    }

    const updated = await db.workspaces.update(workspaceId, { planId: planCode });

    await db.activity.log({
      workspaceId,
      userId: session.id,
      action: "PLAN_UPGRADED",
      entityType: "SUBSCRIPTION_PLAN",
      metadata: { newPlan: planCode },
    });

    return NextResponse.json({ workspace: updated, plan: SUBSCRIPTION_PLANS[planCode] });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to update plan" }, { status: 500 });
  }
}
