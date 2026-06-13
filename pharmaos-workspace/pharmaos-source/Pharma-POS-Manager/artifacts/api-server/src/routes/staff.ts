import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getPharmacyId, requireManagement, type AuthenticatedRequest } from "../middleware/auth";
import { normalizePhone } from "../lib/security";
import { PHARMACY_MODULES, getEnabledModules, getUserEnabledModules, setUserEnabledModules } from "../lib/modules";

const router = Router();
router.use(requireManagement);

const manageableRoles = (actorRole: string) => actorRole === "pharmacy_owner" ? ["manager", "cashier"] : ["cashier"];

const assertCanManage = (actor: AuthenticatedRequest["user"], targetRole: string) => manageableRoles(actor.role).includes(targetRole);

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
    const allowed = manageableRoles(actor.role);
    if (!allowed.includes(role)) return void res.status(403).json({ error: "You cannot assign that role" });
  }
  const [target] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.pharmacyId, pharmacyId)));
  if (!target) return void res.status(404).json({ error: "Staff member not found" });
  if (!assertCanManage(actor, target.role)) {
    return void res.status(403).json({ error: "You cannot manage this staff member" });
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

router.get("/:id/permissions", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const actor = (req as unknown as AuthenticatedRequest).user;
  const id = Number(req.params.id);
  const [target] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.pharmacyId, pharmacyId)));
  if (!target) return void res.status(404).json({ error: "Staff member not found" });
  if (!assertCanManage(actor, target.role)) return void res.status(403).json({ error: "You cannot manage this staff member" });
  const pharmacyModules = await getEnabledModules(pharmacyId);
  res.json({ modules: PHARMACY_MODULES, enabledModules: await getUserEnabledModules(target.id, pharmacyId), pharmacyModules });
});

router.put("/:id/permissions", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const actor = (req as unknown as AuthenticatedRequest).user;
  const id = Number(req.params.id);
  const [target] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.pharmacyId, pharmacyId)));
  if (!target) return void res.status(404).json({ error: "Staff member not found" });
  if (!assertCanManage(actor, target.role)) return void res.status(403).json({ error: "You cannot manage this staff member" });
  const requested: string[] = Array.isArray(req.body.modules) ? req.body.modules.map(String) : [];
  const pharmacyModules = new Set<string>(await getEnabledModules(pharmacyId));
  await setUserEnabledModules(target.id, requested.filter(key => pharmacyModules.has(key)));
  res.json({ modules: await getUserEnabledModules(target.id, pharmacyId) });
});

export default router;
