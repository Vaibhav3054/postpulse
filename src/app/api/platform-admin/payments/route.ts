import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.toUpperCase();

  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") {
    where.status = status;
  }

  const [transactions, capturedAgg, refundedAgg, failedCount] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    prisma.paymentTransaction.aggregate({
      where: { status: PaymentStatus.CAPTURED },
      _sum: { amountPaise: true },
      _count: { id: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: { status: PaymentStatus.REFUNDED },
      _sum: { refundAmountPaise: true },
      _count: { id: true },
    }),
    prisma.paymentTransaction.count({ where: { status: PaymentStatus.FAILED } }),
  ]);

  return NextResponse.json({
    summary: {
      verifiedRevenueInr: Math.round((capturedAgg._sum.amountPaise || 0) / 100),
      capturedCount: capturedAgg._count.id,
      refundedTotalInr: Math.round((refundedAgg._sum.refundAmountPaise || 0) / 100),
      refundedCount: refundedAgg._count.id,
      failedCount,
    },
    transactions,
  });
}
