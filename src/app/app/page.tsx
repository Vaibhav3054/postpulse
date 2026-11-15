import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const instant = false;

export default async function AppRootRedirect() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  const workspaces = await db.workspaces.listForUser(session.id);
  if (workspaces.length === 0) {
    // Fallback if no workspaces exist yet
    redirect("/login");
  }

  const primaryWorkspace = workspaces[0];
  redirect(`/app/${primaryWorkspace.slug}/dashboard`);
}
