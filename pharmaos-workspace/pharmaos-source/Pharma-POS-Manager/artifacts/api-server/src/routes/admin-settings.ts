import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import {
  credentialRevealAuditsTable,
  db,
  platformSmsSettingsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireSuperAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { decryptSecret, encryptSecret, maskSecret, normalizePhone } from "../lib/security";
import { ensurePlatformSmsSettings, platformMpesaToken, sendPlatformSms } from "../lib/platform-sms";

const router = Router();
router.use(requireSuperAdmin);

const formatted = (config: typeof platformSmsSettingsTable.$inferSelect) => ({
  baseUrl: config.baseUrl,
  apiKey: config.apiKeyEncrypted ? maskSecret(decryptSecret(config.apiKeyEncrypted)) : null,
  partnerId: config.partnerIdEncrypted ? maskSecret(decryptSecret(config.partnerIdEncrypted)) : null,
  shortcode: config.shortcode,
  sendEndpointPath: config.sendEndpointPath,
  hashedEndpointPath: config.hashedEndpointPath,
  statusEndpointPath: config.statusEndpointPath,
  unitRate: Number(config.unitRate),
  smsEnabled: Boolean(config.smsEnabled),
  smsVerifiedAt: config.smsVerifiedAt?.toISOString() ?? null,
  smsDlrCallbackUrl: `${process.env.PUBLIC_API_URL ?? ""}/api/messages/dlr/${config.smsCallbackToken}`,
  mpesaEnvironment: config.mpesaEnvironment,
  mpesaShortcode: config.mpesaShortcode,
  mpesaTransactionType: config.mpesaTransactionType,
  mpesaConsumerKey: config.mpesaConsumerKeyEncrypted ? maskSecret(decryptSecret(config.mpesaConsumerKeyEncrypted)) : null,
  mpesaConsumerSecret: config.mpesaConsumerSecretEncrypted ? maskSecret(decryptSecret(config.mpesaConsumerSecretEncrypted)) : null,
  mpesaPasskey: config.mpesaPasskeyEncrypted ? maskSecret(decryptSecret(config.mpesaPasskeyEncrypted)) : null,
  mpesaEnabled: Boolean(config.mpesaEnabled),
  mpesaVerifiedAt: config.mpesaVerifiedAt?.toISOString() ?? null,
  mpesaCallbackUrl: `${process.env.PUBLIC_API_URL ?? ""}/api/messages/billing/stk/${config.mpesaCallbackToken}/callback`,
});

async function verifyPassword(req: AuthenticatedRequest) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.userId));
  return Boolean(user && await bcrypt.compare(String(req.body.password ?? ""), user.passwordHash));
}

router.get("/", async (_req, res) => {
  res.json(formatted(await ensurePlatformSmsSettings()));
});

router.put("/", async (req, res) => {
  const existing = await ensurePlatformSmsSettings();
  const unitRate = Number(req.body.unitRate ?? existing.unitRate);
  if (!Number.isFinite(unitRate) || unitRate <= 0) return void res.status(400).json({ error: "SMS unit rate must be greater than zero" });
  if (req.body.smsEnabled && (!(req.body.baseUrl ?? existing.baseUrl) || !(req.body.shortcode ?? existing.shortcode) || (!req.body.apiKey && !existing.apiKeyEncrypted) || (!req.body.partnerId && !existing.partnerIdEncrypted))) {
    return void res.status(400).json({ error: "Gateway URL, shortcode, API key, and partner ID are required before enabling SMS" });
  }
  if (req.body.mpesaEnabled && (!(req.body.mpesaShortcode ?? existing.mpesaShortcode) || (!req.body.mpesaConsumerKey && !existing.mpesaConsumerKeyEncrypted) || (!req.body.mpesaConsumerSecret && !existing.mpesaConsumerSecretEncrypted) || (!req.body.mpesaPasskey && !existing.mpesaPasskeyEncrypted))) {
    return void res.status(400).json({ error: "Shortcode, consumer key, consumer secret, and passkey are required before enabling SMS billing M-PESA" });
  }
  const values = {
    id: 1,
    baseUrl: String(req.body.baseUrl ?? existing.baseUrl),
    apiKeyEncrypted: req.body.apiKey ? encryptSecret(String(req.body.apiKey)) : existing.apiKeyEncrypted,
    partnerIdEncrypted: req.body.partnerId ? encryptSecret(String(req.body.partnerId)) : existing.partnerIdEncrypted,
    shortcode: String(req.body.shortcode ?? existing.shortcode),
    sendEndpointPath: String(req.body.sendEndpointPath ?? existing.sendEndpointPath),
    hashedEndpointPath: String(req.body.hashedEndpointPath ?? existing.hashedEndpointPath),
    statusEndpointPath: String(req.body.statusEndpointPath ?? existing.statusEndpointPath),
    unitRate: String(unitRate),
    smsEnabled: req.body.smsEnabled ? 1 : 0,
    smsCallbackToken: existing.smsCallbackToken || crypto.randomBytes(24).toString("hex"),
    mpesaEnvironment: String(req.body.mpesaEnvironment ?? existing.mpesaEnvironment),
    mpesaShortcode: String(req.body.mpesaShortcode ?? existing.mpesaShortcode),
    mpesaTransactionType: String(req.body.mpesaTransactionType ?? existing.mpesaTransactionType),
    mpesaConsumerKeyEncrypted: req.body.mpesaConsumerKey ? encryptSecret(String(req.body.mpesaConsumerKey)) : existing.mpesaConsumerKeyEncrypted,
    mpesaConsumerSecretEncrypted: req.body.mpesaConsumerSecret ? encryptSecret(String(req.body.mpesaConsumerSecret)) : existing.mpesaConsumerSecretEncrypted,
    mpesaPasskeyEncrypted: req.body.mpesaPasskey ? encryptSecret(String(req.body.mpesaPasskey)) : existing.mpesaPasskeyEncrypted,
    mpesaCallbackToken: existing.mpesaCallbackToken || crypto.randomBytes(24).toString("hex"),
    mpesaEnabled: req.body.mpesaEnabled ? 1 : 0,
  };
  await db.insert(platformSmsSettingsTable).values(values).onDuplicateKeyUpdate({ set: values });
  res.json({ success: true, settings: formatted(await ensurePlatformSmsSettings()) });
});

router.post("/reveal", async (req, res) => {
  const auth = req as AuthenticatedRequest;
  if (!(await verifyPassword(auth))) return void res.status(401).json({ error: "Password confirmation failed" });
  const config = await ensurePlatformSmsSettings();
  await db.insert(credentialRevealAuditsTable).values({ userId: auth.user.userId, scope: "platform_sms_settings", targetId: 1 });
  res.json({
    apiKey: config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : "",
    partnerId: config.partnerIdEncrypted ? decryptSecret(config.partnerIdEncrypted) : "",
    mpesaConsumerKey: config.mpesaConsumerKeyEncrypted ? decryptSecret(config.mpesaConsumerKeyEncrypted) : "",
    mpesaConsumerSecret: config.mpesaConsumerSecretEncrypted ? decryptSecret(config.mpesaConsumerSecretEncrypted) : "",
    mpesaPasskey: config.mpesaPasskeyEncrypted ? decryptSecret(config.mpesaPasskeyEncrypted) : "",
  });
});

router.post("/test-mpesa", async (_req, res) => {
  try {
    await platformMpesaToken();
    await db.update(platformSmsSettingsTable).set({ mpesaVerifiedAt: new Date() }).where(eq(platformSmsSettingsTable.id, 1));
    res.json({ success: true, message: "SMS billing M-PESA credentials verified" });
  } catch (error: any) {
    res.status(502).json({ error: error.message || "Unable to verify SMS billing M-PESA credentials" });
  }
});

router.post("/test-sms", async (req, res) => {
  const phone = normalizePhone(String(req.body.phone ?? ""));
  if (!phone || phone.length < 12) return void res.status(400).json({ error: "Enter a valid test phone number" });
  try {
    const result = await sendPlatformSms(phone, "PharmaOS SMS gateway test");
    if (!result.parsed.success) return void res.status(502).json({ error: result.parsed.responseDescription || "SMS gateway test failed" });
    await db.update(platformSmsSettingsTable).set({ smsVerifiedAt: new Date() }).where(eq(platformSmsSettingsTable.id, 1));
    res.json({ success: true, message: "Test SMS accepted by provider", provider: result.parsed });
  } catch (error: any) {
    res.status(502).json({ error: error.message || "Unable to test SMS gateway" });
  }
});

export default router;
