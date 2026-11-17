import { requireAdminServerSession } from "@/lib/admin-auth";
import { PlatformAdminConsole } from "@/components/platform-admin/PlatformAdminConsole";

export const instant = false;

export default async function PlatformAdminPage() {
  const admin = await requireAdminServerSession();

  return (
    <PlatformAdminConsole
      admin={{
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
      }}
    />
  );
}
