import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/db";

export const instant = false;

export default async function AppRootRedirect() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, status: true, tokenVersion: true },
  });
  if (
    !dbUser ||
    dbUser.status === "SUSPENDED" ||
    (typeof session.tokenVersion === "number" && session.tokenVersion !== dbUser.tokenVersion)
  ) {
    redirect("/login");
  }

  const workspaces = await db.workspaces.listForUser(session.id);
  if (workspaces.length === 0) {
    // Automatically create a default starter workspace if none exists
    const defaultName = `${session.fullName || session.email.split("@")[0]}'s Brand`;
    const defaultSlug = defaultName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
    const newWs = await db.workspaces.create({
      name: defaultName,
      slug: defaultSlug,
      ownerId: session.id,
    });
    redirect(`/app/${newWs.slug}/dashboard`);
  }

  const primaryWorkspace = workspaces[0];
  redirect(`/app/${primaryWorkspace.slug}/dashboard`);
}
