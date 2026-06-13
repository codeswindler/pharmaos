import crypto from "node:crypto";
import {
  db,
  platformSmsSettingsTable,
  smsPurchasesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { decryptSecret, normalizePhone } from "./security";
import { joinUrl, parseProviderResponse } from "./sms";

export async function ensurePlatformSmsSettings() {
  await db.insert(platformSmsSettingsTable).values({
    id: 1,
    smsCallbackToken: crypto.randomBytes(24).toString("hex"),
    mpesaCallbackToken: crypto.randomBytes(24).toString("hex"),
  }).onDuplicateKeyUpdate({ set: { id: 1 } });
  return (await db.select().from(platformSmsSettingsTable).where(eq(platformSmsSettingsTable.id, 1)))[0];
}

export async function platformMpesaToken() {
  const config = await ensurePlatformSmsSettings();
  if (!config.mpesaEnabled || !config.mpesaConsumerKeyEncrypted || !config.mpesaConsumerSecretEncrypted) {
    throw new Error("SMS billing M-PESA is not configured and enabled");
  }
  const base = config.mpesaEnvironment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${decryptSecret(config.mpesaConsumerKeyEncrypted)}:${decryptSecret(config.mpesaConsumerSecretEncrypted)}`).toString("base64");
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) {
    const raw = await response.text();
    try {
      const parsed = JSON.parse(raw);
      throw new Error(parsed.errorMessage ?? parsed.responseDescription ?? parsed.error ?? "Safaricom credential verification failed");
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(raw.length < 300 ? raw : "Safaricom credential verification failed");
      throw error;
    }
  }
  return { config, base, token: ((await response.json()) as { access_token: string }).access_token };
}

export async function initiateSmsPurchaseStk(purchaseId: number, phone: string, amount: number) {
  if (!process.env.PUBLIC_API_URL) throw new Error("PUBLIC_API_URL must be configured for SMS billing callbacks");
  const { config, base, token } = await platformMpesaToken();
  if (!config.mpesaShortcode || !config.mpesaPasskeyEncrypted) throw new Error("SMS billing shortcode and passkey are required");
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const password = Buffer.from(`${config.mpesaShortcode}${decryptSecret(config.mpesaPasskeyEncrypted)}${timestamp}`).toString("base64");
  const response = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.mpesaTransactionType,
      Amount: Math.ceil(amount),
      PartyA: normalizePhone(phone),
      PartyB: config.mpesaShortcode,
      PhoneNumber: normalizePhone(phone),
      CallBackURL: `${process.env.PUBLIC_API_URL}/api/messages/billing/stk/${config.mpesaCallbackToken}/callback`,
      AccountReference: `SMS-${purchaseId}`,
      TransactionDesc: "PharmaOS SMS campaign",
    }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || !data.CheckoutRequestID) {
    throw new Error(String(data.errorMessage ?? data.ResponseDescription ?? "SMS billing STK Push failed"));
  }
  await db.update(smsPurchasesTable).set({
    checkoutRequestId: String(data.CheckoutRequestID),
    phone: normalizePhone(phone),
  }).where(eq(smsPurchasesTable.id, purchaseId));
  return { checkoutRequestId: String(data.CheckoutRequestID), customerMessage: String(data.CustomerMessage ?? "STK Push sent") };
}

export async function sendPlatformSms(mobile: string, message: string, hashed = false) {
  const config = await ensurePlatformSmsSettings();
  if (!config.smsEnabled || !config.baseUrl || !config.apiKeyEncrypted || !config.partnerIdEncrypted || !config.shortcode) {
    throw new Error("Platform SMS gateway is not configured and enabled");
  }
  const response = await fetch(joinUrl(config.baseUrl, hashed ? config.hashedEndpointPath : config.sendEndpointPath), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: decryptSecret(config.apiKeyEncrypted),
      partnerID: decryptSecret(config.partnerIdEncrypted),
      mobile,
      message,
      shortcode: config.shortcode,
      hashed,
    }),
  });
  const payload = await response.json().catch(async () => ({
    "response-code": response.status,
    "response-description": await response.text(),
  }));
  return { payload, parsed: parseProviderResponse(payload) };
}
