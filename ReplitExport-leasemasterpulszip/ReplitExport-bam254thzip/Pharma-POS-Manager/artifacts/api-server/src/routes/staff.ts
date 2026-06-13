import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getPharmacyId, requireManagement, type AuthenticatedRequest } from "../middleware/auth";
import { normalizePhone } from "../lib/security";

const router = Router();
router.use(requireManagement);

router.get("/", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const rows = await db.select().from(usersTable).where(eq(usersTable.pharmacyId, pharmacyId));
  res.json(rows.map(({ passwordHash: _, ...user }) => user));
});

router.post("/", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const actor = (req as unknown as AuthenticatedRequest).user;
  const { name, email, phone, password, role = "cashier" } = req.body;
  const allowed = actor.role === "pharmacy_owner" ? ["manager", "cashier"] : ["cashier"];
  if (!allowed.includes(role)) return void res.status(403).json({ error: "You cannot create that role" });
  if (!name || !email || !phone || !password) return void res.status(400).json({ error: "Name, email, phone, and password are required" });
  const [{ id }] = await db.insert(usersTable).values({
    name, email: email.toLowerCase(), phone: normalizePhone(phone),
    passwordHash: await bcrypt.hash(password, 12), role, pharmacyId,
  }).$returningId();
  res.status(201).json({ id });
});

router.patch("/:id", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const actor = (req as unknown as AuthenticatedRequest).user;
  const id = Number(req.params.id);
  const { name, email, phone, role, isActive, password } = req.body;
  if (role !== undefined) {
    const allowed = actor.role === "pharmacy_owner" ? ["manager", "cashier"] : ["cashier"];
    if (!allowed.includes(role)) return void res.status(403).json({ error: "You cannot assign that role" });
  }
  const [target] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.pharmacyId, pharmacyId)));
  if (!target) return void res.status(404).json({ error: "Staff member not found" });
  if (actor.role === "manager" && target.role !== "cashier") {
    return void res.status(403).json({ error: "Managers can only update cashiers" });
  }
  const update: Record<string, unknown> = {
    ...(name !== undefined && { name }), ...(email !== undefined && { email: email.toLowerCase() }),
    ...(phone !== undefined && { phone: normalizePhone(phone) }), ...(role !== undefined && { role }),
    ...(isActive !== undefined && { isActive }),
  };
  if (password) update.passwordHash = await bcrypt.hash(password, 12);
  await db.update(usersTable).set(update).where(and(eq(usersTable.id, id), eq(usersTable.pharmacyId, pharmacyId)));
  res.json({ success: true });
});

export default router;
