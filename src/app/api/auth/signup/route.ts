import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, signSessionToken, getSessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, workspaceName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
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

    // Automatically create the user's primary starter workspace
    const rawWsName = workspaceName?.trim() || `${userDisplayName}'s Brand`;
    const baseSlug = rawWsName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";

    const newWorkspace = await db.workspaces.create({
      name: rawWsName,
      slug: baseSlug,
      ownerId: newUser.id,
    });

    const sessionUser = {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      systemRole: newUser.systemRole,
    };

    const token = signSessionToken(sessionUser);
    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({
      user: sessionUser,
      workspaceSlug: newWorkspace.slug,
    });
    response.cookies.set(cookieOptions.name, token, cookieOptions);

    return response;
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Signup failed" }, { status: 500 });
  }
}
