import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/authorization";
import { SUBSCRIPTION_PLANS } from "@/lib/quota";

export async function GET() {
  return NextResponse.json({ plans: Object.values(SUBSCRIPTION_PLANS) });
}

/**
 * Direct unverified plan upgrades are strictly blocked.
 * Paid upgrades must flow through verified Razorpay checkout/webhooks (Phase 5)
 * or authorized Super Admin entitlement (Phase 6).
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  return NextResponse.json(
    {
      error:
        "Direct plan upgrades without payment verification are disabled. Please complete checkout via Razorpay billing.",
      code: "PAYMENT_VERIFICATION_REQUIRED",
    },
    { status: 403 }
  );
}
