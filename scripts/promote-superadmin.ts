/**
 * Safe CLI helper to promote an existing PostPulse user to SUPERADMIN.
 * Usage: npx tsx --env-file=.env scripts/promote-superadmin.ts founder@yourdomain.com
 */
import { PrismaClient, SystemRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx --env-file=.env scripts/promote-superadmin.ts <user-email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}. Sign up first, then run this script.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { systemRole: SystemRole.SUPERADMIN, status: "ACTIVE" },
  });

  console.log(`✓ Promoted ${email} (${user.id}) to SUPERADMIN.`);
  console.log("  You can now log in at /platform-admin/login using your account password.");
}

main()
  .catch((err) => {
    console.error("Failed to promote Super Admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
