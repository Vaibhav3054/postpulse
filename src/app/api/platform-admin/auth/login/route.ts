import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { parseJsonBody, loginSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import {
  getAdminCookieOptions,
  isEmailAllowedForSuperAdmin,
  recordAdminAuditLog,
  signAdminSessionToken,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, loginSchema);
  if (parsed.error) return parsed.error;

  const email = parsed.data.email.toLowerCase();
  const clientIp = getClientIp(req);

  const rl = await checkRateLimit(`auth:admin:login:${clientIp}:${email}`, 8, 15 * 60 * 1000);
  if (!rl.allowed) {
    return rateLimitExceededResponse(
      rl,
      "Too many Super Admin login attempts. Please wait before retrying."
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const passwordValid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is suspended." }, { status: 403 });
  }

  if (user.systemRole !== "SUPERADMIN" || !isEmailAllowedForSuperAdmin(user.email)) {
    return NextResponse.json(
      { error: "Forbidden: This account does not have Super Admin privileges." },
      { status: 403 }
    );
  }

  const adminUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    systemRole: "SUPERADMIN" as const,
    tokenVersion: user.tokenVersion,
  };

  const token = signAdminSessionToken(adminUser);
  const cookieOptions = getAdminCookieOptions();

  await recordAdminAuditLog({
    admin: adminUser,
    action: "ADMIN_LOGIN",
    entityType: "ADMIN_SESSION",
    entityId: adminUser.id,
    req,
  });

  const response = NextResponse.json({
    admin: {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      systemRole: adminUser.systemRole,
    },
  });
  response.cookies.set(cookieOptions.name, token, cookieOptions);
  return response;
}
