import bcrypt from "bcryptjs";
import { db, usersTable } from "./index";

async function main() {
  const hash = await bcrypt.hash("Admin@123", 12);
  await db.insert(usersTable).values({
    name: "System Admin",
    email: "admin@pharmaos.co.ke",
    passwordHash: hash,
    role: "admin",
    isActive: true,
  }).onConflictDoUpdate({
    target: usersTable.email,
    set: { passwordHash: hash, role: "admin", isActive: true },
  });
  console.log("✓ Admin created: admin@pharmaos.co.ke / Admin@123");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
