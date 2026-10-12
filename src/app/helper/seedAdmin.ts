import { UserRole, UserStatus, Shift } from "@prisma/client";
import config from "../config/index.js";
import { prisma } from "../shared/prisma.js";
import bcrypt from "bcryptjs";

export const seedAdmin = async () => {
  try {
    if (!config.admin?.email || !config.admin?.password) {
      console.warn("⚠️  ADMIN_EMAIL or ADMIN_PASSWORD missing → skipping seed");
      return;
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { email: config.admin.email },
    });

    if (existingAdmin) {
      console.log("✅ Admin already exists → skipping seed");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      config.admin.password,
      Number(config.bcrypt_salt_rounds) || 12
    );

    const admin = await prisma.user.create({
      data: {
        email: config.admin.email,
        passwordHash: hashedPassword,
        name: "System Administrator",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        phone: "01893292965",
        roll: "885626",
        semester: 6,
        shift: Shift.DAY,
        group: "B",
      },
    });

    console.log("🎉 Admin seeded successfully!");
    console.log({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      password: config.admin.password, // only for development
    });
  } catch (error: any) {
    // Handle race condition / double execution
    if (error.code === "P2002") {
      console.log("✅ Admin already exists (unique constraint)");
      return;
    }
    console.error("❌ Failed to seed admin:", error.message);
  }
};

// Only run when this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}