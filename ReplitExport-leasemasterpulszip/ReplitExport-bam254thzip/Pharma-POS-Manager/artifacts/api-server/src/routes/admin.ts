import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, hospitalsTable, usersTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAdmin);

router.get("/hospitals", async (_req, res) => {
  try {
    const hospitals = await db.select().from(hospitalsTable).orderBy(desc(hospitalsTable.createdAt));
    const withCounts = await Promise.all(
      hospitals.map(async (h) => {
        const [{ value }] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.hospitalId, h.id));
        return { ...h, userCount: Number(value) };
      })
    );
    res.json(withCounts);
  } catch {
    res.status(500).json({ error: "Failed to fetch hospitals" });
  }
});

router.post("/hospitals", async (req, res) => {
  try {
    const { name, address, phone, email, licenseNumber, planType, planValue, adminName, adminEmail, adminPassword } = req.body;
    if (!name || !planType || !adminName || !adminEmail || !adminPassword) {
      res.status(400).json({ error: "Name, plan, admin name, email and password are required" });
      return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "A user with that email already exists" });
      return;
    }
    const [hospital] = await db.insert(hospitalsTable).values({
      name, address, phone, email, licenseNumber,
      planType: planType ?? "subscription",
      planValue: String(planValue ?? "0"),
      status: "active",
    }).returning();
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const [user] = await db.insert(usersTable).values({
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: "client",
      hospitalId: hospital.id,
      isActive: true,
    }).returning();
    res.status(201).json({ hospital, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    res.status(500).json({ error: "Failed to create hospital" });
  }
});

router.put("/hospitals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, phone, email, licenseNumber, planType, planValue, status } = req.body;
    const [updated] = await db.update(hospitalsTable).set({
      ...(name && { name }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(licenseNumber !== undefined && { licenseNumber }),
      ...(planType && { planType }),
      ...(planValue !== undefined && { planValue: String(planValue) }),
      ...(status && { status }),
    }).where(eq(hospitalsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Hospital not found" }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update hospital" });
  }
});

router.delete("/hospitals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.hospitalId, id));
    await db.update(hospitalsTable).set({ status: "suspended" }).where(eq(hospitalsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to suspend hospital" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const hospitals = await db.select().from(hospitalsTable);
    const total = hospitals.length;
    const active = hospitals.filter(h => h.status === "active").length;
    const suspended = hospitals.filter(h => h.status === "suspended").length;
    const subscriptions = hospitals.filter(h => h.planType === "subscription");
    const monthlyRevenue = subscriptions.reduce((sum, h) => sum + Number(h.planValue), 0);
    const [{ value: totalUsers }] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.role, "client"));
    res.json({ total, active, suspended, monthlyRevenue, totalUsers: Number(totalUsers) });
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
