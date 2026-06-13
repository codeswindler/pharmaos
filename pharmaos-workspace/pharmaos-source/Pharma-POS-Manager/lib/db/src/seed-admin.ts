import bcrypt from "bcryptjs";
import { db, usersTable } from "./index";

async function main() {
  const hash = await bcrypt.hash("Admin@123", 12);

  await db.insert(usersTable).values({
    name: "System Admin",
    email: "admin@pharmaos.co.ke",
    phone: "254700000001",
    passwordHash: hash,
    role: "super_admin",
    isActive: true,
  }).onDuplicateKeyUpdate({
    set: { passwordHash: hash, role: "super_admin", isActive: true },
  });

  console.log("Admin created: admin@pharmaos.co.ke / Admin@123");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
