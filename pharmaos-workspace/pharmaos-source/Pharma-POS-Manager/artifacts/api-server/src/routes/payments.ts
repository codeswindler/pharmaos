import { Router } from "express";
import { db, checkoutsTable, mpesaConfigsTable, paymentsTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { decryptSecret, normalizePhone } from "../lib/security";
import { getPharmacyId, requireAuth, verifyToken } from "../middleware/auth";
import { expireStaleCheckouts, refreshCheckout } from "../lib/checkout-service";

const router = Router();
const listeners = new Map<number, Set<(data: unknown) => void>>();
const emit = (pharmacyId: number, data: unknown) => listeners.get(pharmacyId)?.forEach(send => send(data));

const formatPayment = (p: typeof paymentsTable.$inferSelect) => ({
  ...p, amount: Number(p.amount), appliedAmount: Number(p.appliedAmount), changeAmount: Number(p.changeAmount),
});

async function configByPharmacy(pharmacyId: number) {
  const [config] = await db.select().from(mpesaConfigsTable).where(and(eq(mpesaConfigsTable.pharmacyId, pharmacyId), eq(mpesaConfigsTable.enabled, true)));
  if (!config) throw new Error("M-PESA is not enabled for this pharmacy");
  return config;
}

async function tokenFor(config: typeof mpesaConfigsTable.$inferSelect) {
  const base = config.environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${decryptSecret(config.consumerKeyEncrypted)}:${decryptSecret(config.consumerSecretEncrypted)}`).toString("base64");
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!response.ok) throw new Error(await response.text());
  return { base, token: ((await response.json()) as { access_token: string }).access_token };
}

router.get("/events", (req, res) => {
  try {
    const auth = verifyToken(String(req.query.token ?? ""));
    if (!auth.pharmacyId) throw new Error();
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const set = listeners.get(auth.pharmacyId) ?? new Set();
    set.add(send);
    listeners.set(auth.pharmacyId, set);
    send({ type: "connected" });
    req.on("close", () => set.delete(send));
  } catch {
    res.status(401).end();
  }
});

router.post(["/c2b/:token/validation", "/mpesa/c2b/:token/validation"], async (req, res) => {
  const [config] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.callbackToken, String(req.params.token)));
  res.json(config ? { ResultCode: 0, ResultDesc: "Accepted" } : { ResultCode: 1, ResultDesc: "Rejected" });
});

router.post(["/c2b/:token/confirmation", "/mpesa/c2b/:token/confirmation"], async (req, res) => {
  const [config] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.callbackToken, String(req.params.token)));
  if (!config) return void res.status(404).json({ ResultCode: 1, ResultDesc: "Unknown pharmacy" });
  const referenceCode = String(req.body.TransID ?? "");
  const values = {
    pharmacyId: config.pharmacyId, method: "mpesa", amount: String(req.body.TransAmount ?? 0),
    status: "unmatched", source: "c2b", referenceCode,
    payerPhone: normalizePhone(String(req.body.MSISDN ?? "")), payerName: String(req.body.FirstName ?? "").trim() || null,
    rawPayload: JSON.stringify(req.body).slice(0, 4096), receivedAt: new Date(),
  };
  await db.insert(paymentsTable).values(values).onDuplicateKeyUpdate({ set: { rawPayload: values.rawPayload } });
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.referenceCode, referenceCode));
  emit(config.pharmacyId, { type: "payment_received", payment: formatPayment(payment) });
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.post(["/stk/:token/callback", "/mpesa/stk/:token/callback"], async (req, res) => {
  const [config] = await db.select().from(mpesaConfigsTable).where(eq(mpesaConfigsTable.callbackToken, String(req.params.token)));
  if (!config) return void res.status(404).json({ ResultCode: 1, ResultDesc: "Unknown pharmacy" });
  const callback = req.body?.Body?.stkCallback;
  if (callback) {
    const items: Array<{ Name: string; Value: unknown }> = callback.CallbackMetadata?.Item ?? [];
    const get = (name: string) => items.find(item => item.Name === name)?.Value;
    const succeeded = callback.ResultCode === 0;
    const referenceCode = succeeded ? String(get("MpesaReceiptNumber") ?? "") : null;
    const values = {
      pharmacyId: config.pharmacyId, method: "mpesa", amount: String(get("Amount") ?? 0),
      status: succeeded ? "unmatched" : "failed", source: "stk", referenceCode, checkoutRequestId: String(callback.CheckoutRequestID),
      payerPhone: normalizePhone(String(get("PhoneNumber") ?? "")), rawPayload: JSON.stringify(req.body).slice(0, 4096), receivedAt: new Date(),
    };
    await db.insert(paymentsTable).values(values).onDuplicateKeyUpdate({ set: { referenceCode, amount: values.amount, status: values.status, rawPayload: values.rawPayload } });
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.checkoutRequestId, values.checkoutRequestId));
    emit(config.pharmacyId, { type: succeeded ? "payment_received" : "payment_failed", payment: formatPayment(payment) });
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.use(requireAuth);

router.post("/mpesa/initiate", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  await expireStaleCheckouts(pharmacyId);
  const config = await configByPharmacy(pharmacyId);
  const { checkoutId, phone, amount } = req.body;
  if (!process.env.PUBLIC_API_URL) return void res.status(503).json({ error: "PUBLIC_API_URL must be configured for STK callbacks" });
  const [checkout] = await db.select().from(checkoutsTable).where(and(eq(checkoutsTable.id, Number(checkoutId)), eq(checkoutsTable.pharmacyId, pharmacyId), eq(checkoutsTable.status, "open")));
  if (!checkout || Number(amount) <= 0 || Number(amount) > Number(checkout.balanceAmount)) return void res.status(400).json({ error: "Invalid checkout or amount" });
  const { base, token } = await tokenFor(config);
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const password = Buffer.from(`${config.shortcode}${decryptSecret(config.passkeyEncrypted ?? "")}${timestamp}`).toString("base64");
  const response = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode, Password: password, Timestamp: timestamp, TransactionType: config.transactionType,
      Amount: Math.ceil(Number(amount)), PartyA: normalizePhone(phone), PartyB: config.shortcode, PhoneNumber: normalizePhone(phone),
      CallBackURL: `${process.env.PUBLIC_API_URL}/api/payments/stk/${config.callbackToken}/callback`,
      AccountReference: `Checkout-${checkout.id}`, TransactionDesc: "PharmaOS checkout",
    }),
  });
  const data = await response.json() as any;
  if (!response.ok || !data.CheckoutRequestID) return void res.status(502).json({ error: data.errorMessage ?? "STK Push failed" });
  await db.insert(paymentsTable).values({
    pharmacyId, method: "mpesa", amount: String(amount), status: "pending", source: "stk",
    checkoutRequestId: data.CheckoutRequestID, payerPhone: normalizePhone(phone),
  });
  res.json({ checkoutRequestId: data.CheckoutRequestID });
});

router.get("/unmatched", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  await expireStaleCheckouts(pharmacyId);
  const checkoutId = Number(req.query.checkoutId);
  const [checkout] = await db.select().from(checkoutsTable).where(and(eq(checkoutsTable.id, checkoutId), eq(checkoutsTable.pharmacyId, pharmacyId)));
  if (!checkout) return void res.status(404).json({ error: "Checkout not found" });
  const rows = await db.select().from(paymentsTable).where(and(eq(paymentsTable.pharmacyId, pharmacyId), isNull(paymentsTable.checkoutId), eq(paymentsTable.status, "unmatched"))).orderBy(desc(paymentsTable.receivedAt));
  const balance = Number(checkout.balanceAmount);
  rows.sort((a, b) => {
    const aExact = Number(a.amount) === balance ? 0 : 1;
    const bExact = Number(b.amount) === balance ? 0 : 1;
    const aOver = Number(a.amount) > balance ? 1 : 0;
    const bOver = Number(b.amount) > balance ? 1 : 0;
    return aExact - bExact || aOver - bOver || b.receivedAt.getTime() - a.receivedAt.getTime();
  });
  res.json(rows.map(formatPayment));
});

router.post("/cash", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  await expireStaleCheckouts(pharmacyId);
  const { checkoutId, amount } = req.body;
  const [checkout] = await db.select().from(checkoutsTable).where(and(eq(checkoutsTable.id, Number(checkoutId)), eq(checkoutsTable.pharmacyId, pharmacyId), eq(checkoutsTable.status, "open")));
  if (!checkout || Number(amount) <= 0) return void res.status(400).json({ error: "Invalid checkout or amount" });
  const applied = Math.min(Number(amount), Number(checkout.balanceAmount));
  const [{ id }] = await db.insert(paymentsTable).values({
    pharmacyId, checkoutId: checkout.id, method: "cash", amount: String(amount),
    appliedAmount: String(applied), changeAmount: String(Math.max(0, Number(amount) - applied)), status: "attached", source: "manual", attachedAt: new Date(),
  }).$returningId();
  await refreshCheckout(checkout.id);
  res.status(201).json(formatPayment((await db.select().from(paymentsTable).where(eq(paymentsTable.id, id)))[0]));
});

router.post("/:id/attach", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  await expireStaleCheckouts(pharmacyId);
  const paymentId = Number(req.params.id);
  const checkoutId = Number(req.body.checkoutId);
  const [payment] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.pharmacyId, pharmacyId), isNull(paymentsTable.checkoutId), eq(paymentsTable.status, "unmatched")));
  const [checkout] = await db.select().from(checkoutsTable).where(and(eq(checkoutsTable.id, checkoutId), eq(checkoutsTable.pharmacyId, pharmacyId), eq(checkoutsTable.status, "open")));
  if (!payment || !checkout) return void res.status(404).json({ error: "Payment or checkout not found" });
  if (Number(payment.amount) > Number(checkout.balanceAmount)) return void res.status(409).json({ error: "M-PESA payment exceeds the remaining balance" });
  await db.update(paymentsTable).set({ checkoutId, status: "attached", appliedAmount: payment.amount, attachedAt: new Date() }).where(eq(paymentsTable.id, paymentId));
  await refreshCheckout(checkoutId);
  res.json({ success: true });
});

export default router;
