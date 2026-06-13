import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db, pharmaciesTable, usersTable, mpesaConfigsTable, smsConfigsTable, smsWalletsTable, smsWalletTransactionsTable, messagesTable, messageRecipientsTable } from "@workspace/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { requireSuperAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { decryptSecret, encryptSecret, maskSecret, normalizePhone } from "../lib/security";

const router = Router();
router.use(requireSuperAdmin);

const formatConfig = (config: typeof mpesaConfigsTable.$inferSelect | undefined) => config ? ({
  environment: config.environment, shortcode: config.shortcode, transactionType: config.transactionType,
  enabled: config.enabled, consumerKey: maskSecret(decryptSecret(config.consumerKeyEncrypted)),
  consumerSecret: maskSecret(decryptSecret(config.consumerSecretEncrypted)),
  passkey: config.passkeyEncrypted ? maskSecret(decryptSecret(config.passkeyEncrypted)) : null,
  registrationStatus: config.registrationStatus,
  credentialsVerifiedAt: config.credentialsVerifiedAt?.toISOString() ?? null,
  callbacksRegisteredAt: config.callbacksRegisteredAt?.toISOString() ?? null,
}) : null;

const formatSmsConfig = (config: typeof smsConfigsTable.$inferSelect | undefined) => config ? ({
  baseUrl: config.baseUrl,
  apiKey: config.apiKeyEncrypted ? maskSecret(decryptSecret(config.apiKeyEncrypted)) : null,
  partnerId: config.partnerIdEncrypted ? maskSecret(decryptSecret(config.partnerIdEncrypted)) : null,
  shortcode: config.shortcode,
  sendEndpointPath: config.sendEndpointPath,
  hashedEndpointPath: config.hashedEndpointPath,
  statusEndpointPath: config.statusEndpointPath,
  unitRate: Number(config.unitRate),
  enabled: Boolean(config.enabled),
}) : null;

router.get("/pharmacies", async (_req, res) => {
  const pharmacies = await db.select().from(pharmaciesTable).orderBy(desc(pharmaciesTable.createdAt));
  const result = await Promise.all(pharmacies.map(async pharmacy => {
    const [{ value }] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.pharmacyId, pharmacy.id));
    const [config] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.pharmacyId, pharmacy.id));
    const [sms] = await db.select().from(smsConfigsTable).where(eq(smsConfigsTable.pharmacyId, pharmacy.id));
    const [wallet] = await db.select().from(smsWalletsTable).where(eq(smsWalletsTable.pharmacyId, pharmacy.id));
    const requests = await db.select().from(smsWalletTransactionsTable).where(and(eq(smsWalletTransactionsTable.pharmacyId, pharmacy.id), eq(smsWalletTransactionsTable.type, "top_up_request")));
    return { ...pharmacy, userCount: Number(value), mpesa: formatConfig(config), sms: formatSmsConfig(sms), smsWalletBalance: Number(wallet?.balance ?? 0), pendingSmsTopUp: requests.reduce((sum, row) => sum + Number(row.amount), 0) };
  }));
  res.json(result);
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
  if (!response.ok) throw new Error(await response.text());
  return { config, base, token: ((await response.json()) as { access_token: string }).access_token };
}

router.post("/pharmacies/:id/mpesa/test", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  await getToken(pharmacyId);
  await db.update(mpesaConfigsTable).set({ credentialsVerifiedAt: new Date() }).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
  res.json({ success: true });
});

router.post("/pharmacies/:id/mpesa/register-callbacks", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  const { config, base, token } = await getToken(pharmacyId);
  const publicUrl = process.env.PUBLIC_API_URL;
  if (!publicUrl) return void res.status(400).json({ error: "PUBLIC_API_URL must be configured" });
  const response = await fetch(`${base}/mpesa/c2b/v2/registerurl`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ShortCode: config.shortcode, ResponseType: "Completed",
      ConfirmationURL: `${publicUrl}/api/payments/mpesa/c2b/${config.callbackToken}/confirmation`,
      ValidationURL: `${publicUrl}/api/payments/mpesa/c2b/${config.callbackToken}/validation`,
    }),
  });
  if (!response.ok) {
    await db.update(mpesaConfigsTable).set({ registrationStatus: "failed" }).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
    return void res.status(502).json({ error: await response.text() });
  }
  await db.update(mpesaConfigsTable).set({ callbacksRegisteredAt: new Date(), registrationStatus: "registered" }).where(eq(mpesaConfigsTable.pharmacyId, pharmacyId));
  res.json({ success: true, response: await response.json() });
});

router.put("/pharmacies/:id/sms", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  if (!Number.isInteger(pharmacyId)) return void res.status(400).json({ error: "Invalid pharmacy id" });
  const {
    baseUrl = "", apiKey, partnerId, shortcode = "", sendEndpointPath = "/api/services/sendsms",
    hashedEndpointPath = "/api/services/sendotp", statusEndpointPath = "/api/services/getdlr",
    unitRate = 1, enabled = false,
  } = req.body;
  const [existing] = await db.select().from(smsConfigsTable).where(eq(smsConfigsTable.pharmacyId, pharmacyId));
  if (Number(unitRate) <= 0) return void res.status(400).json({ error: "SMS unit rate must be greater than zero" });
  if (enabled && (!baseUrl || !shortcode || (!existing && (!apiKey || !partnerId)))) {
    return void res.status(400).json({ error: "Base URL, shortcode, API key, and partner ID are required before enabling SMS" });
  }
  const values = {
    pharmacyId, baseUrl, shortcode, sendEndpointPath, hashedEndpointPath, statusEndpointPath,
    unitRate: String(unitRate), enabled: enabled ? 1 : 0,
    apiKeyEncrypted: apiKey ? encryptSecret(apiKey) : existing?.apiKeyEncrypted ?? null,
    partnerIdEncrypted: partnerId ? encryptSecret(partnerId) : existing?.partnerIdEncrypted ?? null,
    callbackToken: existing?.callbackToken ?? crypto.randomBytes(24).toString("hex"),
  };
  await db.insert(smsConfigsTable).values(values).onDuplicateKeyUpdate({ set: values });
  await db.insert(smsWalletsTable).values({ pharmacyId }).onDuplicateKeyUpdate({ set: { pharmacyId } });
  const [saved] = await db.select().from(smsConfigsTable).where(eq(smsConfigsTable.pharmacyId, pharmacyId));
  res.json({ success: true, config: formatSmsConfig(saved), callbackUrl: `${process.env.PUBLIC_API_URL ?? ""}/api/messages/dlr/${saved.callbackToken}` });
});

router.post("/pharmacies/:id/sms-wallet/credit", async (req, res) => {
  const pharmacyId = Number(req.params.id);
  if (!Number.isInteger(pharmacyId)) return void res.status(400).json({ error: "Invalid pharmacy id" });
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return void res.status(400).json({ error: "Enter a valid credit amount" });
  await db.insert(smsWalletsTable).values({ pharmacyId }).onDuplicateKeyUpdate({ set: { pharmacyId } });
  await db.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} + ${amount}` }).where(eq(smsWalletsTable.pharmacyId, pharmacyId));
  const [wallet] = await db.select().from(smsWalletsTable).where(eq(smsWalletsTable.pharmacyId, pharmacyId));
  await db.insert(smsWalletTransactionsTable).values({
    pharmacyId, createdBy: (req as unknown as AuthenticatedRequest).user.userId, type: "admin_credit",
    amount: String(amount), balanceAfter: wallet.balance, reference: String(req.body.reference ?? "Admin wallet credit"),
  });
  await db.update(smsWalletTransactionsTable).set({ type: "top_up_approved" }).where(and(eq(smsWalletTransactionsTable.pharmacyId, pharmacyId), eq(smsWalletTransactionsTable.type, "top_up_request")));
  res.json({ success: true, balance: Number(wallet.balance) });
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
