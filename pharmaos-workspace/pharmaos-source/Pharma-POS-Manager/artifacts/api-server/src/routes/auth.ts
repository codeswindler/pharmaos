import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, pharmaciesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, requireAuth, type AuthenticatedRequest, type UserRole } from "../middleware/auth";
import { normalizePhone } from "../lib/security";
import { getEnabledModules } from "../lib/modules";

const router = Router();

const publicUser = (user: typeof usersTable.$inferSelect) => ({
  id: user.id, name: user.name, email: user.email, phone: user.phone,
  role: user.role as UserRole, pharmacyId: user.pharmacyId,
});

router.post("/login", async (req, res) => {
  const identifier = String(req.body?.identifier ?? req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!identifier || !password) return void res.status(400).json({ error: "Email or phone and password are required" });

  const email = identifier.toLowerCase();
  const phone = normalizePhone(identifier);
  const [user] = await db.select().from(usersTable).where(or(eq(usersTable.email, email), eq(usersTable.phone, phone))).limit(1);
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return void res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role as UserRole, pharmacyId: user.pharmacyId });
  const pharmacy = user.pharmacyId
    ? (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, user.pharmacyId)).limit(1))[0] ?? null
    : null;
  res.json({ token, user: publicUser(user), pharmacy, modules: await getEnabledModules(user.pharmacyId) });
});

router.get("/me", requireAuth, async (req, res) => {
  const auth = (req as AuthenticatedRequest).user;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, auth.userId)).limit(1);
  if (!user) return void res.status(404).json({ error: "User not found" });
  const pharmacy = user.pharmacyId
    ? (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, user.pharmacyId)).limit(1))[0] ?? null
    : null;
  res.json({ user: publicUser(user), pharmacy, modules: await getEnabledModules(user.pharmacyId) });
});

export default router;
