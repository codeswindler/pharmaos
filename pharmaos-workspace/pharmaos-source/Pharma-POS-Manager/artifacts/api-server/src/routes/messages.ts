import crypto from "node:crypto";
import { Router } from "express";
import {
  db, checkoutsTable, messagesTable, messageRecipientsTable, paymentsTable, smsConfigsTable,
  smsWalletsTable, smsWalletTransactionsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getPharmacyId, requireAuth, requireManagement, type AuthenticatedRequest } from "../middleware/auth";
import { normalizePhone } from "../lib/security";
import { countGsm7, joinUrl, parseDeliveryStatus, parseProviderResponse, providerCredentials } from "../lib/sms";

const router = Router();

const formatMessage = (m: typeof messagesTable.$inferSelect) => ({
  ...m,
  estimatedCost: Number(m.estimatedCost),
  actualCost: Number(m.actualCost),
});

async function ensureWallet(pharmacyId: number) {
  await db.insert(smsWalletsTable).values({ pharmacyId }).onDuplicateKeyUpdate({ set: { pharmacyId } });
  return (await db.select().from(smsWalletsTable).where(eq(smsWalletsTable.pharmacyId, pharmacyId)))[0];
}

async function configFor(pharmacyId: number, enabled = false) {
  const [config] = await db.select().from(smsConfigsTable).where(eq(smsConfigsTable.pharmacyId, pharmacyId));
  if (!config || (enabled && !config.enabled)) throw new Error(enabled ? "SMS gateway is not enabled for this pharmacy" : "SMS gateway is not configured");
  return config;
}

async function smsSummary(pharmacyId: number) {
  const wallet = await ensureWallet(pharmacyId);
  const [config] = await db.select().from(smsConfigsTable).where(eq(smsConfigsTable.pharmacyId, pharmacyId));
  const contacts = await salesContacts(pharmacyId, "all");
  const pendingRows = await db.select().from(smsWalletTransactionsTable).where(and(
    eq(smsWalletTransactionsTable.pharmacyId, pharmacyId),
    eq(smsWalletTransactionsTable.type, "top_up_request"),
  ));
  const unitRate = Number(config?.unitRate ?? 1);
  const balance = Number(wallet.balance);
  const pendingTopUp = pendingRows.reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    balance,
    unitRate,
    availableUnits: unitRate > 0 ? Math.floor(balance / unitRate) : 0,
    pendingTopUp,
    pendingUnits: unitRate > 0 ? Math.floor(pendingTopUp / unitRate) : 0,
    salesContacts: contacts.length,
    gatewayEnabled: Boolean(config?.enabled),
  };
}

async function quoteCampaign(pharmacyId: number, input: { content?: string; recipientType?: string; dateFrom?: string | null; dateTo?: string | null }) {
  const content = String(input.content ?? "");
  const recipientType = String(input.recipientType ?? "all");
  if (!["all", "this_week", "range"].includes(recipientType)) throw new Error("Invalid recipient selection");
  const gsm = countGsm7(content);
  const contacts = content.trim()
    ? await salesContacts(pharmacyId, recipientType, input.dateFrom ?? null, input.dateTo ?? null)
    : [];
  const [config] = await db.select().from(smsConfigsTable).where(eq(smsConfigsTable.pharmacyId, pharmacyId));
  const summary = await smsSummary(pharmacyId);
  const unitRate = Number(config?.unitRate ?? summary.unitRate ?? 1);
  const unitsPerRecipient = gsm.segments;
  const totalUnits = contacts.length * unitsPerRecipient;
  const amountKes = Number((totalUnits * unitRate).toFixed(2));
  const walletShortfall = Math.max(0, Number((amountKes - summary.balance).toFixed(2)));

  return {
    recipientType,
    recipientCount: contacts.length,
    characterCount: gsm.characters,
    segmentCount: gsm.segments,
    unitsPerRecipient,
    totalUnits,
    unitBreakdown: totalUnits > 0 ? [{ unitsPerRecipient, recipients: contacts.length, totalUnits }] : [],
    unitRate,
    amountKes,
    walletBalance: summary.balance,
    walletShortfall,
    pendingTopUp: summary.pendingTopUp,
    pendingUnits: summary.pendingUnits,
    gatewayEnabled: summary.gatewayEnabled,
    canSend: summary.gatewayEnabled && contacts.length > 0 && totalUnits > 0 && gsm.unsupported.length === 0 && walletShortfall === 0,
    unsupported: gsm.unsupported,
  };
}

async function updateCampaignTotals(messageId: number) {
  const recipients = await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.messageId, messageId));
  const sentCount = recipients.filter(row => ["sent", "delivered"].includes(row.status)).length;
  const deliveredCount = recipients.filter(row => row.status === "delivered").length;
  const failedCount = recipients.filter(row => row.status === "failed").length;
  const actualCost = recipients.reduce((sum, row) => sum + (["sent", "delivered"].includes(row.status) ? Number(row.cost) : 0), 0);
  const status = failedCount === recipients.length ? "failed" : failedCount ? "partially_failed" : deliveredCount === recipients.length ? "delivered" : "sent";
  await db.update(messagesTable).set({ sentCount, deliveredCount, failedCount, actualCost: String(actualCost), status }).where(eq(messagesTable.id, messageId));
}

async function salesContacts(pharmacyId: number, recipientType: string, dateFrom?: string | null, dateTo?: string | null) {
  const completed = await db.select().from(checkoutsTable).where(and(eq(checkoutsTable.pharmacyId, pharmacyId), eq(checkoutsTable.status, "completed")));
  const now = new Date();
  const from = recipientType === "this_week"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
    : recipientType === "range" && dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = recipientType === "range" && dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
  const checkoutIds = completed
    .filter(row => (!from || (row.completedAt && row.completedAt >= from)) && (!to || (row.completedAt && row.completedAt <= to)))
    .map(row => row.id);
  if (!checkoutIds.length) return [];
  const rows = await db.select().from(paymentsTable).where(and(
    eq(paymentsTable.pharmacyId, pharmacyId),
    eq(paymentsTable.status, "attached"),
    eq(paymentsTable.method, "mpesa"),
    inArray(paymentsTable.checkoutId, checkoutIds),
  )).orderBy(desc(paymentsTable.receivedAt));
  const unique = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    if (!row.payerPhone) continue;
    const phone = normalizePhone(row.payerPhone);
    if (!unique.has(phone)) unique.set(phone, row);
  }
  return [...unique.entries()].map(([phone, payment]) => ({ phone, payment }));
}

async function sendProvider(config: typeof smsConfigsTable.$inferSelect, mobile: string, message: string, hashed: boolean) {
  const credentials = providerCredentials(config);
  const response = await fetch(joinUrl(config.baseUrl, hashed ? config.hashedEndpointPath : config.sendEndpointPath), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...credentials, mobile, message, shortcode: config.shortcode, hashed }),
  });
  const payload = await response.json().catch(async () => ({ "response-code": response.status, "response-description": await response.text() }));
  return { payload, parsed: parseProviderResponse(payload) };
}

router.post("/dlr/:token", async (req, res) => {
  const [config] = await db.select().from(smsConfigsTable).where(eq(smsConfigsTable.callbackToken, req.params.token));
  if (!config) return void res.status(404).json({ error: "Unknown callback token" });
  const delivery = parseDeliveryStatus(req.body);
  if (delivery.providerMessageId) {
    const [recipient] = await db.select().from(messageRecipientsTable).where(and(
      eq(messageRecipientsTable.pharmacyId, config.pharmacyId),
      eq(messageRecipientsTable.providerMessageId, delivery.providerMessageId),
    ));
    if (recipient) {
      await db.update(messageRecipientsTable).set({
        status: delivery.status,
        responseCode: delivery.responseCode,
        responseDescription: delivery.responseDescription,
        rawResponse: JSON.stringify(req.body),
        statusCheckedAt: new Date(),
        ...(delivery.status === "delivered" ? { deliveredAt: new Date() } : {}),
        ...(delivery.status === "failed" ? { failedAt: new Date() } : {}),
      }).where(eq(messageRecipientsTable.id, recipient.id));
      await updateCampaignTotals(recipient.messageId);
    }
  }
  res.json({ success: true });
});

router.use(requireAuth);

router.get("/summary", async (req, res) => {
  res.json(await smsSummary(getPharmacyId(req)));
});

router.get("/recipients/estimate", async (req, res) => {
  const recipientType = String(req.query.recipientType ?? "all");
  if (!["all", "this_week", "range"].includes(recipientType)) return void res.status(400).json({ error: "Invalid recipient selection" });
  const contacts = await salesContacts(getPharmacyId(req), recipientType, String(req.query.dateFrom ?? ""), String(req.query.dateTo ?? ""));
  res.json({ count: contacts.length });
});

router.post("/quote", requireManagement, async (req, res) => {
  try {
    res.json(await quoteCampaign(getPharmacyId(req), {
      content: req.body.content,
      recipientType: req.body.recipientType,
      dateFrom: req.body.dateFrom,
      dateTo: req.body.dateTo,
    }));
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Unable to calculate SMS quote" });
  }
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(messagesTable).where(eq(messagesTable.pharmacyId, getPharmacyId(req))).orderBy(desc(messagesTable.createdAt));
  res.json(rows.map(formatMessage));
});

router.get("/:id/recipients", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const messageId = Number(req.params.id);
  const [message] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, messageId), eq(messagesTable.pharmacyId, pharmacyId)));
  if (!message) return void res.status(404).json({ error: "Message not found" });
  res.json(await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.messageId, messageId)).orderBy(desc(messageRecipientsTable.createdAt)));
});

router.get("/:id", async (req, res) => {
  const [message] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, Number(req.params.id)), eq(messagesTable.pharmacyId, getPharmacyId(req))));
  if (!message) return void res.status(404).json({ error: "Message not found" });
  res.json(formatMessage(message));
});

router.post("/wallet/top-up", requireManagement, async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return void res.status(400).json({ error: "Enter a valid top-up amount" });
  const wallet = await ensureWallet(pharmacyId);
  await db.insert(smsWalletTransactionsTable).values({
    pharmacyId,
    createdBy: (req as AuthenticatedRequest).user.userId,
    type: "top_up_request",
    amount: String(amount),
    balanceAfter: wallet.balance,
    reference: `REQ-${Date.now()}`,
  });
  const summary = await smsSummary(pharmacyId);
  res.status(202).json({
    success: true,
    message: "Top-up request submitted for admin approval",
    requestedUnits: Math.floor(amount / Number(summary.unitRate || 1)),
    summary,
  });
});

router.post("/:id/refresh-status", requireManagement, async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const messageId = Number(req.params.id);
  let config: typeof smsConfigsTable.$inferSelect;
  try { config = await configFor(pharmacyId, true); }
  catch (error: any) { return void res.status(503).json({ error: error.message }); }
  const credentials = providerCredentials(config);
  const recipients = await db.select().from(messageRecipientsTable).where(and(eq(messageRecipientsTable.messageId, messageId), eq(messageRecipientsTable.pharmacyId, pharmacyId)));
  for (const recipient of recipients.filter(row => row.providerMessageId && !["delivered", "failed"].includes(row.status))) {
    try {
      const response = await fetch(joinUrl(config.baseUrl, config.statusEndpointPath), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, messageid: recipient.providerMessageId }),
      });
      const payload = await response.json();
      const delivery = parseDeliveryStatus(payload);
      await db.update(messageRecipientsTable).set({
        status: delivery.status, responseCode: delivery.responseCode, responseDescription: delivery.responseDescription,
        rawResponse: JSON.stringify(payload), statusCheckedAt: new Date(),
        ...(delivery.status === "delivered" ? { deliveredAt: new Date() } : {}),
        ...(delivery.status === "failed" ? { failedAt: new Date() } : {}),
      }).where(eq(messageRecipientsTable.id, recipient.id));
    } catch {
      await db.update(messageRecipientsTable).set({ statusCheckedAt: new Date() }).where(eq(messageRecipientsTable.id, recipient.id));
    }
  }
  await updateCampaignTotals(messageId);
  res.json({ success: true });
});

router.post("/", requireManagement, async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const { title, content, recipientType = "all", dateFrom = null, dateTo = null } = req.body;
  if (!title || !content || !["all", "this_week", "range"].includes(recipientType)) return void res.status(400).json({ error: "Title, message, and a valid recipient selection are required" });
  if (recipientType === "range" && (!dateFrom || !dateTo)) return void res.status(400).json({ error: "Choose both dates for a custom range" });
  const gsm = countGsm7(String(content));
  if (gsm.unsupported.length) return void res.status(400).json({ error: `Only GSM-7 messages are supported. Remove: ${gsm.unsupported.join(" ")}` });
  let config: typeof smsConfigsTable.$inferSelect;
  try { config = await configFor(pharmacyId, true); }
  catch (error: any) { return void res.status(503).json({ error: error.message }); }
  const contacts = await salesContacts(pharmacyId, recipientType, dateFrom, dateTo);
  if (!contacts.length) return void res.status(400).json({ error: "No M-PESA sales contacts match this recipient selection" });
  const wallet = await ensureWallet(pharmacyId);
  const costPerRecipient = gsm.segments * Number(config.unitRate);
  const estimatedCost = Number((contacts.length * costPerRecipient).toFixed(2));
  if (Number(wallet.balance) < estimatedCost) return void res.status(402).json({ error: `SMS wallet is low. KES ${estimatedCost.toFixed(2)} required, KES ${Number(wallet.balance).toFixed(2)} available.` });

  const [{ id }] = await db.insert(messagesTable).values({
    pharmacyId,
    createdBy: (req as AuthenticatedRequest).user.userId,
    title,
    content,
    recipientType,
    dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`) : null,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`) : null,
    recipientCount: contacts.length,
    characterCount: gsm.characters,
    segmentCount: gsm.segments,
    estimatedCost: String(estimatedCost),
    status: "processing",
  }).$returningId();

  let successful = 0;
  for (const contact of contacts) {
    let payload: any = {};
    let parsed = { success: false, responseCode: "", responseDescription: "Gateway request failed", providerMessageId: null as string | null, networkId: null as string | null };
    try {
      ({ payload, parsed } = await sendProvider(config, contact.phone, content, false));
    } catch (error: any) {
      parsed.responseDescription = error.message;
    }
    if (parsed.success) successful += 1;
    await db.insert(messageRecipientsTable).values({
      messageId: id, pharmacyId, paymentId: contact.payment.id, recipientName: contact.payment.payerName,
      phone: contact.phone, providerMessageId: parsed.providerMessageId, providerNetworkId: parsed.networkId,
      responseCode: parsed.responseCode, responseDescription: parsed.responseDescription,
      status: parsed.success ? "sent" : "failed", cost: String(costPerRecipient),
      rawResponse: JSON.stringify(payload), sentAt: parsed.success ? new Date() : null, failedAt: parsed.success ? null : new Date(),
    });
  }
  const actualCost = successful * costPerRecipient;
  if (actualCost > 0) {
    const balanceAfter = Number(wallet.balance) - actualCost;
    await db.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} - ${actualCost}` }).where(eq(smsWalletsTable.pharmacyId, pharmacyId));
    await db.insert(smsWalletTransactionsTable).values({
      pharmacyId, createdBy: (req as AuthenticatedRequest).user.userId, type: "campaign_debit",
      amount: String(-actualCost), balanceAfter: String(balanceAfter), reference: `MSG-${id}`,
    });
  }
  await db.update(messagesTable).set({ sentAt: new Date() }).where(eq(messagesTable.id, id));
  await updateCampaignTotals(id);
  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  res.status(201).json(formatMessage(message));
});

router.post("/transactional-hashed", requireManagement, async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const { mobile, message, title = "Transactional SMS" } = req.body;
  if (!mobile || !message) return void res.status(400).json({ error: "Hashed mobile and message are required" });
  const gsm = countGsm7(String(message));
  if (gsm.unsupported.length) return void res.status(400).json({ error: "Only GSM-7 messages are supported" });
  let config: typeof smsConfigsTable.$inferSelect;
  try { config = await configFor(pharmacyId, true); }
  catch (error: any) { return void res.status(503).json({ error: error.message }); }
  const wallet = await ensureWallet(pharmacyId);
  const cost = gsm.segments * Number(config.unitRate);
  if (Number(wallet.balance) < cost) return void res.status(402).json({ error: "SMS wallet balance is too low" });
  const [{ id }] = await db.insert(messagesTable).values({
    pharmacyId, createdBy: (req as AuthenticatedRequest).user.userId, title, content: message,
    recipientType: "transactional_hashed", recipientCount: 1, characterCount: gsm.characters,
    segmentCount: gsm.segments, estimatedCost: String(cost), status: "processing",
  }).$returningId();
  const { payload, parsed } = await sendProvider(config, String(mobile), String(message), true);
  await db.insert(messageRecipientsTable).values({
    messageId: id, pharmacyId, phone: String(mobile), isHashed: 1, providerMessageId: parsed.providerMessageId,
    providerNetworkId: parsed.networkId, responseCode: parsed.responseCode, responseDescription: parsed.responseDescription,
    status: parsed.success ? "sent" : "failed", cost: String(cost), rawResponse: JSON.stringify(payload),
    sentAt: parsed.success ? new Date() : null, failedAt: parsed.success ? null : new Date(),
  });
  if (parsed.success) {
    await db.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} - ${cost}` }).where(eq(smsWalletsTable.pharmacyId, pharmacyId));
  }
  await updateCampaignTotals(id);
  res.status(parsed.success ? 201 : 502).json({ success: parsed.success, messageId: id, provider: parsed });
});

export default router;
