import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAdminAuditLog, requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation";
import { getRazorpayConfig } from "@/lib/billing/razorpay";
import { getAllProviderStatuses } from "@/lib/social-providers/oauth-service";
import { getStorageConfig } from "@/lib/storage";
import { isEmailProviderConfigured } from "@/lib/notifications";

const updateSettingSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.unknown(),
  description: z.string().trim().max(300).optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const settings = await prisma.platformSetting.findMany({
    orderBy: { key: "asc" },
  });

  const rz = getRazorpayConfig();
  const storage = getStorageConfig();
  const social = getAllProviderStatuses();

  return NextResponse.json({
    settings,
    integrations: {
      storage: {
        driver: storage.isSupabaseConfigured ? "supabase_storage" : "unconfigured",
        isConfigured: storage.isSupabaseConfigured,
        bucket: storage.isSupabaseConfigured ? storage.bucket : null,
      },
      razorpay: {
        isConfigured: rz.isConfigured,
        isTestMode: rz.isTestMode,
        hasWebhookSecret: rz.hasWebhookSecret,
        missingEnvVars: rz.missingEnvVars,
      },
      email: {
        provider: "resend",
        isConfigured: isEmailProviderConfigured(),
      },
      cron: {
        hasCronSecret: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16),
      },
      socialProviders: social,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, updateSettingSchema);
  if (parsed.error) return parsed.error;

  const { key, value, description, reason } = parsed.data;
  const previous = await prisma.platformSetting.findUnique({ where: { key } });

  const updated = await prisma.platformSetting.upsert({
    where: { key },
    update: {
      value: value as object,
      ...(description !== undefined ? { description } : {}),
      updatedByUserId: auth.admin.id,
    },
    create: {
      key,
      value: value as object,
      description: description || null,
      updatedByUserId: auth.admin.id,
    },
  });

  await recordAdminAuditLog({
    admin: auth.admin,
    action: "PLATFORM_SETTING_UPDATED",
    entityType: "PLATFORM_SETTING",
    entityId: key,
    previousValue: previous?.value ?? null,
    newValue: value,
    reason: reason || `Updated platform setting ${key}`,
    req,
  });

  return NextResponse.json({ success: true, setting: updated });
}
