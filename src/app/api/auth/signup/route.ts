import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, signSessionToken, getSessionCookieOptions } from "@/lib/auth";
import { parseJsonBody, signupSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateResult = await checkRateLimit(`auth:signup:ip:${clientIp}`, 5, 15 * 60 * 1000);
    if (!rateResult.allowed) {
      return rateLimitExceededResponse(
        rateResult,
        "Too many signup attempts. Please wait a few minutes and try again."
      );
    }

    const parsed = await parseJsonBody(req, signupSchema);
    if (parsed.error) return parsed.error;

    const { password, fullName, workspaceName } = parsed.data;
    const normalizedEmail = parsed.data.email.toLowerCase();

    const existingUser = await db.users.findByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const userDisplayName = fullName?.trim() || normalizedEmail.split("@")[0] || "Creator";

    const newUser = await db.users.create({
      email: normalizedEmail,
      passwordHash,
      fullName: userDisplayName,
    });

    // Note: db.users.create already provisions an initial workspace; if a custom workspaceName was provided,
    // rename the initial workspace instead of creating a duplicate (or create one if missing).
    const workspaces = await db.workspaces.listForUser(newUser.id);
    let primaryWorkspaceSlug = workspaces[0]?.slug;

    if (!primaryWorkspaceSlug) {
      const rawWsName = workspaceName?.trim() || `${userDisplayName}'s Brand`;
      const baseSlug =
        rawWsName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "workspace";

      const created = await db.workspaces.create({
        name: rawWsName,
        slug: baseSlug,
        ownerId: newUser.id,
      });
      primaryWorkspaceSlug = created.slug;
    } else if (workspaceName?.trim()) {
      await db.workspaces.update(workspaces[0].id, { name: workspaceName.trim() });
    }

    const sessionUser = {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      systemRole: newUser.systemRole,
      tokenVersion: 0,
    };

    const token = signSessionToken(sessionUser);
    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        systemRole: newUser.systemRole,
      },
      workspaceSlug: primaryWorkspaceSlug,
    });
    response.cookies.set(cookieOptions.name, token, cookieOptions);

    return response;
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Signup failed" }, { status: 500 });
  }
}
