import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSessionToken, getSessionCookieOptions } from "@/lib/auth";
import { parseJsonBody, loginSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, loginSchema);
    if (parsed.error) return parsed.error;

    const normalizedEmail = parsed.data.email.toLowerCase();
    const clientIp = getClientIp(req);

    // Rate limit: 10 attempts per 15 minutes per IP + email, and 30 per IP
    const ipLimit = await checkRateLimit(`auth:login:ip:${clientIp}`, 30, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(
        ipLimit,
        "Too many login attempts from this network. Please wait and try again."
      );
    }

    const accountLimit = await checkRateLimit(
      `auth:login:acct:${clientIp}:${normalizedEmail}`,
      10,
      15 * 60 * 1000
    );
    if (!accountLimit.allowed) {
      return rateLimitExceededResponse(
        accountLimit,
        "Too many failed login attempts for this account. Please wait and try again."
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (user.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "This account has been suspended. Please contact PostPulse support." },
        { status: 403 }
      );
    }

    const isMatch = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      systemRole: user.systemRole,
      tokenVersion: user.tokenVersion,
    };

    const token = signSessionToken(sessionUser);
    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        systemRole: user.systemRole,
      },
    });
    response.cookies.set(cookieOptions.name, token, cookieOptions);

    return response;
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Login failed" }, { status: 500 });
  }
}
