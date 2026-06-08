import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, hospitalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../middleware/auth";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role, hospitalId: user.hospitalId ?? null });
    let hospital = null;
    if (user.hospitalId) {
      const [h] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, user.hospitalId)).limit(1);
      hospital = h ?? null;
    }
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospitalId }, hospital });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const payload = (req as any).user;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    let hospital = null;
    if (user.hospitalId) {
      const [h] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, user.hospitalId)).limit(1);
      hospital = h ?? null;
    }
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospitalId }, hospital });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
