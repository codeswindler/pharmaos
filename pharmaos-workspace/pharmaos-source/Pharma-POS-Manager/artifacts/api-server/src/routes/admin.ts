import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { credentialRevealAuditsTable, db, pool, pharmaciesTable, usersTable, mpesaConfigsTable, messagesTable, messageRecipientsTable } from "@workspace/db";
import { and, count, desc, eq } from "drizzle-orm";
import { requireSuperAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { decryptSecret, encryptSecret, maskSecret, normalizePhone } from "../lib/security";
import { logger } from "../lib/logger";
import { DEFAULT_MODULE_KEYS, PHARMACY_MODULES, getEnabledModules, getUserEnabledModules, setEnabledModules, setUserEnabledModules } from "../lib/modules";

const router = Router();
router.use(requireSuperAdmin);

const readableProviderError = (raw: string, fallback: string) => {
  try {
    const parsed = JSON.parse(raw);
    return parsed.errorMessage ?? parsed.responseDescription ?? parsed["response-description"] ?? parsed.error ?? fallback;
  } catch {
    return raw.length < 300 ? raw : fallback;
  }
};

const maskEncryptedSecret = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return maskSecret(decryptSecret(value));
  } catch {
    return "Stored credential - re-save to rotate";
  }
};

const formatConfig = (config: typeof mpesaConfigsTable.$inferSelect | undefined) => config ? ({
  environment: config.environment, shortcode: config.shortcode, transactionType: config.transactionType,
  enabled: config.enabled, consumerKey: maskEncryptedSecret(config.consumerKeyEncrypted),
  consumerSecret: maskEncryptedSecret(config.consumerSecretEncrypted),
  passkey: maskEncryptedSecret(config.passkeyEncrypted),
  registrationStatus: config.registrationStatus,
  credentialsVerifiedAt: config.credentialsVerifiedAt?.toISOString() ?? null,
  callbacksRegisteredAt: config.callbacksRegisteredAt?.toISOString() ?? null,
}) : null;

const publicUser = ({ passwordHash: _passwordHash, ...user }: typeof usersTable.$inferSelect) => user;

const smsFinancials = async (pharmacyId: number) => {
  const [[row]] = await pool.query<any[]>(`
    SELECT
      COALESCE(w.balance, 0) AS smsCredit,
      COALESCE(SUM(CASE WHEN sp.status IN ('paid','processing','completed','sent','partially_failed') THEN sp.paid_amount ELSE 0 END), 0) AS smsRevenue,
      COALESCE(SUM(m.actual_cost), 0) AS smsSendCost,
      COALESCE(SUM(sp.refund_credit), 0) AS refundCredit
    FROM pharmacies p
    LEFT JOIN sms_wallets w ON w.pharmacy_id = p.id
    LEFT JOIN sms_purchases sp ON sp.pharmacy_id = p.id
    LEFT JOIN messages m ON m.id = sp.message_id
    WHERE p.id = ?
    GROUP BY p.id, w.balance
  `, [pharmacyId]);
  const smsCredit = Number(row?.smsCredit ?? 0);
  const smsRevenue = Number(row?.smsRevenue ?? 0);
  const smsSendCost = Number(row?.smsSendCost ?? 0);
  const refundCredit = Number(row?.refundCredit ?? 0);
  return { smsCredit, smsRevenue, smsSendCost, refundCredit, smsCommission: smsRevenue - smsSendCost - refundCredit };
};

const recentCampaigns = async (pharmacyId: number) => {
  const [rows] = await pool.query<any[]>(`
    SELECT
      m.id, m.title, m.status, m.recipient_count AS recipientCount, m.actual_cost AS actualCost,
      sp.paid_amount AS paidAmount, sp.refund_credit AS refundCredit, m.created_at AS createdAt
    FROM messages m
    LEFT JOIN sms_purchases sp ON sp.message_id = m.id
    WHERE m.pharmacy_id = ?
    ORDER BY m.created_at DESC
    LIMIT 10
  `, [pharmacyId]);
  return rows.map(row => ({
    ...row,
    recipientCount: Number(row.recipientCount ?? 0),
    actualCost: Number(row.actualCost ?? 0),
    paidAmount: Number(row.paidAmount ?? 0),
    refundCredit: Number(row.refundCredit ?? 0),
  }));
};

router.get("/pharmacies", async (_req, res) => {
  try {
    const pharmacies = await db.select().from(pharmaciesTable).orderBy(desc(pharmaciesTable.createdAt));
    const result = await Promise.all(pharmacies.map(async pharmacy => {
      const [{ value }] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.pharmacyId, pharmacy.id));
      const [config] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.pharmacyId, pharmacy.id));
      const financials = await smsFinancials(pharmacy.id);
      return { ...pharmacy, userCount: Number(value), mpesa: formatConfig(config), smsWalletBalance: financials.smsCredit, sms: financials, modules: await getEnabledModules(pharmacy.id) };
    }));
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, "Unable to list pharmacies");
    res.status(500).json({ error: "Unable to load pharmacies. Check the PharmaOS server logs for the exact database or credential issue." });
  }
});

router.get("/users", async (_req, res) => {
  const users = await db.select().from(usersTable).where(eq(usersTable.role, "super_admin")).orderBy(desc(usersTable.createdAt));
  res.json(users.map(publicUser));
});

router.post("/users", async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) return void res.status(400).json({ error: "Name, email, phone, and password are required" });
  const [{ id }] = await db.insert(usersTable).values({
    name,
    email: String(email).toLowerCase(),
    phone: normalizePhone(phone),
    passwordHash: await bcrypt.hash(String(password), 12),
    role: "super_admin",
    pharmacyId: null,
    isActive: true,
  }).$returningId();
  res.status(201).json({ id });
});

router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [target] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "super_admin"))).limit(1);
  if (!target) return void res.status(404).json({ error: "Super admin user not found" });
  const { name, email, phone, password, isActive } = req.body;
  const update: Record<string, unknown> = {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email: String(email).toLowerCase() }),
    ...(phone !== undefined && { phone: normalizePhone(phone) }),
    ...(isActive !== undefined && { isActive: Boolean(isActive) }),
  };
  if (password) update.passwordHash = await bcrypt.hash(String(password), 12);
  await db.update(usersTable).set(update).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.get("/pharmacies/:id/overview", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId)).limit(1);
  if (!pharmacy) return void res.status(404).json({ error: "Pharmacy not found" });
  const [{ value: userCount }] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.pharmacyId, pharmacyId));
  const [config] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
  res.json({
    pharmacy,
    userCount: Number(userCount),
    mpesa: formatConfig(config),
    sms: await smsFinancials(pharmacyId),
    campaigns: await recentCampaigns(pharmacyId),
    modules: await getEnabledModules(pharmacyId),
  });
});

router.get("/pharmacies/:id/users", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const rows = await db.select().from(usersTable).where(eq(usersTable.pharmacyId, pharmacyId)).orderBy(desc(usersTable.createdAt));
  res.json(rows.map(publicUser));
});

router.post("/pharmacies/:id/users", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const { name, email, phone, password, role = "cashier" } = req.body;
  if (!["pharmacy_owner", "manager", "cashier"].includes(role)) return void res.status(400).json({ error: "Invalid pharmacy role" });
  if (!name || !email || !phone || !password) return void res.status(400).json({ error: "Name, email, phone, and password are required" });
  const [{ id }] = await db.insert(usersTable).values({
    name,
    email: String(email).toLowerCase(),
    phone: normalizePhone(phone),
    passwordHash: await bcrypt.hash(String(password), 12),
    role,
    pharmacyId,
    isActive: true,
  }).$returningId();
  res.status(201).json({ id });
});

router.patch("/pharmacies/:id/users/:userId", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const [target] = await db.select().from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.pharmacyId, pharmacyId))).limit(1);
  if (!target) return void res.status(404).json({ error: "Pharmacy user not found" });
  const { name, email, phone, password, role, isActive } = req.body;
  if (role !== undefined && !["pharmacy_owner", "manager", "cashier"].includes(role)) return void res.status(400).json({ error: "Invalid pharmacy role" });
  const update: Record<string, unknown> = {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email: String(email).toLowerCase() }),
    ...(phone !== undefined && { phone: normalizePhone(phone) }),
    ...(role !== undefined && { role }),
    ...(isActive !== undefined && { isActive: Boolean(isActive) }),
  };
  if (password) update.passwordHash = await bcrypt.hash(String(password), 12);
  await db.update(usersTable).set(update).where(and(eq(usersTable.id, userId), eq(usersTable.pharmacyId, pharmacyId)));
  res.json({ success: true });
});

router.get("/pharmacies/:id/users/:userId/permissions", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.pharmacyId, pharmacyId))).limit(1);
  if (!user) return void res.status(404).json({ error: "Pharmacy user not found" });
  const pharmacyModules = await getEnabledModules(pharmacyId);
  res.json({ modules: PHARMACY_MODULES, enabledModules: await getUserEnabledModules(user.id, pharmacyId), pharmacyModules });
});

router.put("/pharmacies/:id/users/:userId/permissions", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.pharmacyId, pharmacyId))).limit(1);
  if (!user) return void res.status(404).json({ error: "Pharmacy user not found" });
  const requested: string[] = Array.isArray(req.body.modules) ? req.body.modules.map(String) : [];
  const pharmacyModules = new Set<string>(await getEnabledModules(pharmacyId));
  await setUserEnabledModules(user.id, requested.filter(key => pharmacyModules.has(key)));
  res.json({ modules: await getUserEnabledModules(user.id, pharmacyId) });
});

router.get("/modules", async (_req, res) => {
  const pharmacies = await db.select().from(pharmaciesTable).orderBy(desc(pharmaciesTable.createdAt));
  res.json({
    modules: PHARMACY_MODULES,
    pharmacies: await Promise.all(pharmacies.map(async pharmacy => ({
      ...pharmacy,
      modules: await getEnabledModules(pharmacy.id),
    }))),
  });
});

router.put("/pharmacies/:id/modules", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const moduleKeys = Array.isArray(req.body.modules) ? req.body.modules.map(String) : DEFAULT_MODULE_KEYS;
  res.json({ modules: await setEnabledModules(pharmacyId, moduleKeys) });
});

router.post("/pharmacies", async (req, res) => {
  const { name, address, phone, email, planType, planValue, ownerName, ownerEmail, ownerPhone, ownerPassword } = req.body;
  if (!name || !ownerName || !ownerEmail || !ownerPhone || !ownerPassword) {
    return void res.status(400).json({ error: "Pharmacy and owner details are required" });
  }
  const [{ id: pharmacyId }] = await db.insert(pharmaciesTable).values({
    name, address: address || null, phone: phone || null, email: email || null,
    planType: planType ?? "subscription", planValue: String(planValue ?? 0),
  }).$returningId();
  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const [{ id: ownerId }] = await db.insert(usersTable).values({
    name: ownerName, email: ownerEmail.toLowerCase(), phone: normalizePhone(ownerPhone),
    passwordHash, role: "pharmacy_owner", pharmacyId,
  }).$returningId();
  res.status(201).json({ pharmacyId, ownerId });
});

router.put("/pharmacies/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, address, phone, email, planType, planValue, status } = req.body;
  await db.update(pharmaciesTable).set({
    ...(name !== undefined && { name }), ...(address !== undefined && { address }),
    ...(phone !== undefined && { phone }), ...(email !== undefined && { email }),
    ...(planType !== undefined && { planType }), ...(planValue !== undefined && { planValue: String(planValue) }),
    ...(status !== undefined && { status }),
  }).where(eq(pharmaciesTable.id, id));
  res.json((await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, id)))[0]);
});

router.delete("/pharmacies/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.pharmacyId, id));
  await db.update(pharmaciesTable).set({ status: "suspended" }).where(eq(pharmaciesTable.id, id));
  res.json({ success: true });
});

router.put("/pharmacies/:id/mpesa", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const { environment = "sandbox", shortcode, transactionType = "CustomerPayBillOnline", consumerKey, consumerSecret, passkey, enabled = false } = req.body;
  const [existing] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
  if (!shortcode || (!existing && (!consumerKey || !consumerSecret))) {
    return void res.status(400).json({ error: "Shortcode, consumer key, and consumer secret are required" });
  }
  const values = {
    pharmacyId, environment, shortcode, transactionType, enabled,
    consumerKeyEncrypted: consumerKey ? encryptSecret(consumerKey) : existing!.consumerKeyEncrypted,
    consumerSecretEncrypted: consumerSecret ? encryptSecret(consumerSecret) : existing!.consumerSecretEncrypted,
    passkeyEncrypted: passkey ? encryptSecret(passkey) : existing?.passkeyEncrypted ?? null,
    callbackToken: existing?.callbackToken ?? crypto.randomBytes(24).toString("hex"),
  };
  await db.insert(mpesaConfigsTable).values(values).onDuplicateKeyUpdate({ set: values });
  res.json({ success: true, config: formatConfig((await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId)))[0]) });
});

async function getToken(pharmacyId: number) {
  const [config] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
  if (!config) throw new Error("M-PESA configuration not found");
  const base = config.environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${decryptSecret(config.consumerKeyEncrypted)}:${decryptSecret(config.consumerSecretEncrypted)}`).toString("base64");
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!response.ok) throw new Error(readableProviderError(await response.text(), "Safaricom credential verification failed"));
  return { config, base, token: ((await response.json()) as { access_token: string }).access_token };
}

router.post("/pharmacies/:id/mpesa/test", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  try {
    await getToken(pharmacyId);
    await db.update(mpesaConfigsTable).set({ credentialsVerifiedAt: new Date() }).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
    res.json({ success: true, message: "Pharmacy M-PESA credentials verified" });
  } catch (error: any) {
    res.status(502).json({ error: error.message || "Unable to verify pharmacy M-PESA credentials" });
  }
});

router.post("/pharmacies/:id/mpesa/register-callbacks", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  let auth;
  try { auth = await getToken(pharmacyId); }
  catch (error: any) { return void res.status(502).json({ error: error.message || "Unable to authenticate with Safaricom" }); }
  const { config, base, token } = auth;
  const publicUrl = process.env.PUBLIC_API_URL;
  if (!publicUrl) return void res.status(400).json({ error: "PUBLIC_API_URL must be configured" });
  const response = await fetch(`${base}/mpesa/c2b/v2/registerurl`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ShortCode: config.shortcode, ResponseType: "Completed",
      ConfirmationURL: `${publicUrl}/api/payments/c2b/${config.callbackToken}/confirmation`,
      ValidationURL: `${publicUrl}/api/payments/c2b/${config.callbackToken}/validation`,
    }),
  });
  if (!response.ok) {
    const providerError = await response.text();
    logger.error({ pharmacyId, providerError }, "C2B callback registration failed");
    await db.update(mpesaConfigsTable).set({ registrationStatus: "failed" }).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
    return void res.status(502).json({ error: readableProviderError(providerError, "Safaricom rejected the callback registration") });
  }
  await db.update(mpesaConfigsTable).set({ callbacksRegisteredAt: new Date(), registrationStatus: "registered" }).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
  res.json({ success: true, message: "C2B callbacks registered", response: await response.json() });
});

router.post("/pharmacies/:id/mpesa/reveal", async (req, res) => {
  const auth = req as unknown as AuthenticatedRequest;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, auth.user.userId));
  if (!user || !(await bcrypt.compare(String(req.body.password ?? ""), user.passwordHash))) {
    return void res.status(401).json({ error: "Password confirmation failed" });
  }
  const pharmacyId = Number(req.params.id);
  const [config] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
  if (!config) return void res.status(404).json({ error: "M-PESA configuration not found" });
  await db.insert(credentialRevealAuditsTable).values({ userId: auth.user.userId, scope: "pharmacy_mpesa", targetId: pharmacyId });
  res.json({
    consumerKey: decryptSecret(config.consumerKeyEncrypted),
    consumerSecret: decryptSecret(config.consumerSecretEncrypted),
    passkey: config.passkeyEncrypted ? decryptSecret(config.passkeyEncrypted) : "",
  });
});

router.get("/pharmacies/:id/messages", async (req, res) => {
  const rows = await db.select().from(messagesTable).where(eq(messagesTable.pharmacyId, Number(req.params.id))).orderBy(desc(messagesTable.createdAt));
  res.json(rows.map(row => ({ ...row, estimatedCost: Number(row.estimatedCost), actualCost: Number(row.actualCost) })));
});

router.get("/messages/:id/recipients", async (req, res) => {
  res.json(await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.messageId, Number(req.params.id))).orderBy(desc(messageRecipientsTable.createdAt)));
});

router.get("/stats", async (_req, res) => {
  const pharmacies = await db.select().from(pharmaciesTable);
  const [{ value: totalUsers }] = await db.select({ value: count() }).from(usersTable);
  res.json({
    total: pharmacies.length, active: pharmacies.filter(p => p.status === "active").length,
    suspended: pharmacies.filter(p => p.status === "suspended").length,
    monthlyRevenue: pharmacies.filter(p => p.planType === "subscription").reduce((sum, p) => sum + Number(p.planValue), 0),
    totalUsers: Number(totalUsers),
  });
});

export default router;
