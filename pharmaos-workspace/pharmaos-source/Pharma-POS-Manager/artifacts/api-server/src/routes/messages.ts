import { Router } from "express";
import {
  checkoutsTable,
  db,
  messageRecipientsTable,
  messagesTable,
  paymentsTable,
  smsPurchasesTable,
  smsWalletsTable,
  smsWalletTransactionsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getPharmacyId, requireAuth, requireManagement, type AuthenticatedRequest } from "../middleware/auth";
import { normalizePhone } from "../lib/security";
import { countGsm7, joinUrl, parseDeliveryStatus } from "../lib/sms";
import { ensurePlatformSmsSettings, initiateSmsPurchaseStk } from "../lib/platform-sms";
import { processSmsPurchase } from "../lib/sms-campaign-service";
import { logger } from "../lib/logger";

const router = Router();
const moneyNumber = (value: unknown) => Number(Number(value ?? 0).toFixed(2));
const formatMessage = (row: typeof messagesTable.$inferSelect) => ({ ...row, estimatedCost: Number(row.estimatedCost), actualCost: Number(row.actualCost) });
const formatPurchase = (row: typeof smsPurchasesTable.$inferSelect) => ({
  ...row,
  quotedAmount: Number(row.quotedAmount),
  creditApplied: Number(row.creditApplied),
  amountDue: Number(row.amountDue),
  paidAmount: Number(row.paidAmount),
  refundCredit: Number(row.refundCredit),
});

async function ensureWallet(pharmacyId: number) {
  await db.insert(smsWalletsTable).values({ pharmacyId }).onDuplicateKeyUpdate({ set: { pharmacyId } });
  return (await db.select().from(smsWalletsTable).where(eq(smsWalletsTable.pharmacyId, pharmacyId)))[0];
}

async function salesContacts(pharmacyId: number, recipientType: string, dateFrom?: string | null, dateTo?: string | null) {
  const completed = await db.select().from(checkoutsTable).where(and(eq(checkoutsTable.pharmacyId, pharmacyId), eq(checkoutsTable.status, "completed")));
  const now = new Date();
  const from = recipientType === "this_week"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
    : recipientType === "range" && dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = recipientType === "range" && dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
  const checkoutIds = completed.filter(row =>
    (!from || Boolean(row.completedAt && row.completedAt >= from))
    && (!to || Boolean(row.completedAt && row.completedAt <= to)),
  ).map(row => row.id);
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

async function quoteCampaign(pharmacyId: number, input: { content?: string; recipientType?: string; dateFrom?: string | null; dateTo?: string | null }) {
  const content = String(input.content ?? "");
  const recipientType = String(input.recipientType ?? "all");
  if (!["all", "this_week", "range"].includes(recipientType)) throw new Error("Invalid recipient selection");
  const gsm = countGsm7(content);
  const contacts = content.trim() ? await salesContacts(pharmacyId, recipientType, input.dateFrom, input.dateTo) : [];
  const settings = await ensurePlatformSmsSettings();
  const wallet = await ensureWallet(pharmacyId);
  const unitRate = Number(settings.unitRate);
  const totalUnits = contacts.length * gsm.segments;
  const amountKes = moneyNumber(totalUnits * unitRate);
  const availableCredit = Number(wallet.balance);
  const creditApplied = Math.min(availableCredit, amountKes);
  const amountDue = moneyNumber(amountKes - creditApplied);
  return {
    recipientType,
    recipientCount: contacts.length,
    characterCount: gsm.characters,
    segmentCount: gsm.segments,
    unitsPerRecipient: gsm.segments,
    totalUnits,
    unitRate,
    amountKes,
    availableCredit,
    creditApplied,
    amountDue,
    gatewayEnabled: Boolean(settings.smsEnabled),
    billingMpesaEnabled: Boolean(settings.mpesaEnabled),
    canPurchase: Boolean(settings.smsEnabled) && contacts.length > 0 && totalUnits > 0 && gsm.unsupported.length === 0 && (amountDue === 0 || Boolean(settings.mpesaEnabled)),
    unsupported: gsm.unsupported,
    contacts,
  };
}

async function updateMessageTotals(messageId: number) {
  const recipients = await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.messageId, messageId));
  const sentCount = recipients.filter(row => ["sent", "delivered"].includes(row.status)).length;
  const deliveredCount = recipients.filter(row => row.status === "delivered").length;
  const failedCount = recipients.filter(row => row.status === "failed").length;
  const actualCost = recipients.reduce((sum, row) => sum + (["sent", "delivered"].includes(row.status) ? Number(row.cost) : 0), 0);
  const status = failedCount === recipients.length ? "failed" : failedCount ? "partially_failed" : deliveredCount === recipients.length ? "delivered" : "sent";
  await db.update(messagesTable).set({ sentCount, deliveredCount, failedCount, actualCost: String(actualCost), status }).where(eq(messagesTable.id, messageId));
}

async function returnLateFailureCredit(recipient: typeof messageRecipientsTable.$inferSelect) {
  if (recipient.creditReturnedAt) return;
  await db.transaction(async tx => {
    const claim = await tx.update(messageRecipientsTable).set({ creditReturnedAt: new Date() })
      .where(and(eq(messageRecipientsTable.id, recipient.id), isNull(messageRecipientsTable.creditReturnedAt)));
    if (!Number((claim as any)[0]?.affectedRows ?? 0)) return;
    await tx.insert(smsWalletsTable).values({ pharmacyId: recipient.pharmacyId }).onDuplicateKeyUpdate({ set: { pharmacyId: recipient.pharmacyId } });
    await tx.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} + ${recipient.cost}` }).where(eq(smsWalletsTable.pharmacyId, recipient.pharmacyId));
    const [wallet] = await tx.select().from(smsWalletsTable).where(eq(smsWalletsTable.pharmacyId, recipient.pharmacyId));
    const [purchase] = await tx.select().from(smsPurchasesTable).where(eq(smsPurchasesTable.messageId, recipient.messageId));
    if (purchase) {
      await tx.update(smsPurchasesTable).set({ refundCredit: sql`${smsPurchasesTable.refundCredit} + ${recipient.cost}` }).where(eq(smsPurchasesTable.id, purchase.id));
    }
    await tx.insert(smsWalletTransactionsTable).values({
      pharmacyId: recipient.pharmacyId,
      type: "delivery_failure_credit",
      amount: recipient.cost,
      balanceAfter: wallet.balance,
      reference: `SMS-RECIPIENT-${recipient.id}`,
    });
  });
}

router.post("/billing/stk/:token/callback", async (req, res) => {
  const settings = await ensurePlatformSmsSettings();
  if (settings.mpesaCallbackToken !== req.params.token) return void res.status(404).json({ ResultCode: 1, ResultDesc: "Unknown callback token" });
  const callback = req.body?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) return void res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  const [purchase] = await db.select().from(smsPurchasesTable).where(eq(smsPurchasesTable.checkoutRequestId, String(callback.CheckoutRequestID)));
  if (!purchase) return void res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  if (purchase.status !== "awaiting_payment") return void res.json({ ResultCode: 0, ResultDesc: "Already processed" });
  const items: Array<{ Name: string; Value: unknown }> = callback.CallbackMetadata?.Item ?? [];
  const get = (name: string) => items.find(item => item.Name === name)?.Value;
  const paidAmount = moneyNumber(get("Amount") ?? 0);
  if (Number(callback.ResultCode) === 0 && paidAmount === Number(purchase.amountDue)) {
    const result = await db.update(smsPurchasesTable).set({
      status: "paid",
      paidAmount: String(paidAmount),
      referenceCode: String(get("MpesaReceiptNumber") ?? ""),
      paidAt: new Date(),
      rawPayload: JSON.stringify(req.body),
    }).where(and(eq(smsPurchasesTable.id, purchase.id), eq(smsPurchasesTable.status, "awaiting_payment")));
    if (Number((result as any)[0]?.affectedRows ?? 0)) void processSmsPurchase(purchase.id);
  } else {
    const failureReason = Number(callback.ResultCode) === 0
      ? `Payment amount mismatch: expected ${purchase.amountDue}, received ${paidAmount}`
      : String(callback.ResultDesc ?? "STK payment failed");
    const result = await db.update(smsPurchasesTable).set({
      status: "payment_failed",
      failureReason,
      paidAmount: String(paidAmount),
      referenceCode: Number(callback.ResultCode) === 0 ? String(get("MpesaReceiptNumber") ?? "") : null,
      rawPayload: JSON.stringify(req.body),
    }).where(and(eq(smsPurchasesTable.id, purchase.id), eq(smsPurchasesTable.status, "awaiting_payment")));
    if (Number((result as any)[0]?.affectedRows ?? 0) && Number(purchase.creditApplied) > 0) {
      await db.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} + ${purchase.creditApplied}` }).where(eq(smsWalletsTable.pharmacyId, purchase.pharmacyId));
      const wallet = await ensureWallet(purchase.pharmacyId);
      await db.insert(smsWalletTransactionsTable).values({
        pharmacyId: purchase.pharmacyId,
        createdBy: purchase.createdBy,
        type: "payment_failed_credit_release",
        amount: purchase.creditApplied,
        balanceAfter: wallet.balance,
        reference: `SMS-PURCHASE-${purchase.id}`,
      });
    }
    await db.update(messagesTable).set({ status: "payment_failed" }).where(eq(messagesTable.id, purchase.messageId));
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.post("/dlr/:token", async (req, res) => {
  const settings = await ensurePlatformSmsSettings();
  if (settings.smsCallbackToken !== req.params.token) return void res.status(404).json({ error: "Unknown callback token" });
  const delivery = parseDeliveryStatus(req.body);
  if (delivery.providerMessageId) {
    const [recipient] = await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.providerMessageId, delivery.providerMessageId));
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
      if (delivery.status === "failed") await returnLateFailureCredit(recipient);
      await updateMessageTotals(recipient.messageId);
    }
  }
  res.json({ success: true });
});

router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const wallet = await ensureWallet(pharmacyId);
  const settings = await ensurePlatformSmsSettings();
  res.json({
    creditBalance: Number(wallet.balance),
    unitRate: Number(settings.unitRate),
    gatewayEnabled: Boolean(settings.smsEnabled),
    billingMpesaEnabled: Boolean(settings.mpesaEnabled),
    salesContacts: (await salesContacts(pharmacyId, "all")).length,
  });
});

router.post("/quote", requireManagement, async (req, res) => {
  try {
    const quote = await quoteCampaign(getPharmacyId(req), req.body);
    const { contacts: _contacts, ...publicQuote } = quote;
    res.json(publicQuote);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Unable to calculate SMS quote" });
  }
});

router.get("/recipients/estimate", async (req, res) => {
  const recipientType = String(req.query.recipientType ?? "all");
  if (!["all", "this_week", "range"].includes(recipientType)) return void res.status(400).json({ error: "Invalid recipient selection" });
  const contacts = await salesContacts(getPharmacyId(req), recipientType, String(req.query.dateFrom ?? ""), String(req.query.dateTo ?? ""));
  res.json({ count: contacts.length });
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(messagesTable).where(eq(messagesTable.pharmacyId, getPharmacyId(req))).orderBy(desc(messagesTable.createdAt));
  res.json(rows.map(formatMessage));
});

router.get("/purchases/:id", requireManagement, async (req, res) => {
  const [purchase] = await db.select().from(smsPurchasesTable).where(and(
    eq(smsPurchasesTable.id, Number(req.params.id)),
    eq(smsPurchasesTable.pharmacyId, getPharmacyId(req)),
  ));
  if (!purchase) return void res.status(404).json({ error: "SMS purchase not found" });
  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, purchase.messageId));
  res.json({ purchase: formatPurchase(purchase), message: message ? formatMessage(message) : null });
});

router.get("/:id", async (req, res) => {
  const [message] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, Number(req.params.id)), eq(messagesTable.pharmacyId, getPharmacyId(req))));
  if (!message) return void res.status(404).json({ error: "Message not found" });
  res.json(formatMessage(message));
});

router.get("/:id/recipients", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const [message] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, Number(req.params.id)), eq(messagesTable.pharmacyId, pharmacyId)));
  if (!message) return void res.status(404).json({ error: "Message not found" });
  res.json(await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.messageId, message.id)).orderBy(desc(messageRecipientsTable.createdAt)));
});

router.post("/:id/refresh-status", requireManagement, async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const settings = await ensurePlatformSmsSettings();
  if (!settings.smsEnabled || !settings.baseUrl || !settings.apiKeyEncrypted || !settings.partnerIdEncrypted) return void res.status(503).json({ error: "Platform SMS gateway is not configured" });
  const [message] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, Number(req.params.id)), eq(messagesTable.pharmacyId, pharmacyId)));
  if (!message) return void res.status(404).json({ error: "Message not found" });
  const recipients = await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.messageId, message.id));
  for (const recipient of recipients.filter(row => row.providerMessageId && !["delivered", "failed"].includes(row.status))) {
    try {
      const { decryptSecret } = await import("../lib/security");
      const response = await fetch(joinUrl(settings.baseUrl, settings.statusEndpointPath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: decryptSecret(settings.apiKeyEncrypted),
          partnerID: decryptSecret(settings.partnerIdEncrypted),
          messageid: recipient.providerMessageId,
        }),
      });
      const delivery = parseDeliveryStatus(await response.json());
      await db.update(messageRecipientsTable).set({
        status: delivery.status,
        responseCode: delivery.responseCode,
        responseDescription: delivery.responseDescription,
        statusCheckedAt: new Date(),
        ...(delivery.status === "delivered" ? { deliveredAt: new Date() } : {}),
        ...(delivery.status === "failed" ? { failedAt: new Date() } : {}),
      }).where(eq(messageRecipientsTable.id, recipient.id));
      if (delivery.status === "failed") await returnLateFailureCredit(recipient);
    } catch (error) {
      logger.warn({ err: error, recipientId: recipient.id }, "Unable to fetch SMS delivery status");
    }
  }
  await updateMessageTotals(message.id);
  res.json({ success: true });
});

router.post("/transactional-hashed", requireManagement, async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const auth = req as AuthenticatedRequest;
  const { mobile, message, title = "Transactional SMS", paymentPhone } = req.body;
  if (!mobile || !message) return void res.status(400).json({ error: "Hashed mobile and message are required" });
  const gsm = countGsm7(String(message));
  if (gsm.unsupported.length) return void res.status(400).json({ error: "Only GSM-7 messages are supported" });
  const settings = await ensurePlatformSmsSettings();
  if (!settings.smsEnabled) return void res.status(503).json({ error: "Platform SMS gateway is not enabled" });
  const wallet = await ensureWallet(pharmacyId);
  const quotedAmount = moneyNumber(gsm.segments * Number(settings.unitRate));
  const creditApplied = Math.min(Number(wallet.balance), quotedAmount);
  const amountDue = moneyNumber(quotedAmount - creditApplied);
  if (amountDue > 0 && (!settings.mpesaEnabled || !paymentPhone)) return void res.status(400).json({ error: "Enter an M-PESA payment phone for this SMS purchase" });
  const created = await db.transaction(async tx => {
    if (creditApplied > 0) {
      const debit = await tx.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} - ${creditApplied}` })
        .where(and(eq(smsWalletsTable.pharmacyId, pharmacyId), sql`${smsWalletsTable.balance} >= ${creditApplied}`));
      if (!Number((debit as any)[0]?.affectedRows ?? 0)) throw new Error("SMS credit changed. Try again.");
    }
    const [walletAfter] = await tx.select().from(smsWalletsTable).where(eq(smsWalletsTable.pharmacyId, pharmacyId));
    const [{ id: messageId }] = await tx.insert(messagesTable).values({
      pharmacyId, createdBy: auth.user.userId, title, content: message, recipientType: "transactional_hashed",
      recipientCount: 1, characterCount: gsm.characters, segmentCount: gsm.segments,
      estimatedCost: String(quotedAmount), status: amountDue > 0 ? "awaiting_payment" : "paid",
    }).$returningId();
    await tx.insert(messageRecipientsTable).values({ messageId, pharmacyId, phone: String(mobile), isHashed: 1, status: "queued", cost: String(quotedAmount) });
    const [{ id: purchaseId }] = await tx.insert(smsPurchasesTable).values({
      pharmacyId, messageId, createdBy: auth.user.userId, quotedAmount: String(quotedAmount), creditApplied: String(creditApplied),
      amountDue: String(amountDue), paidAmount: String(amountDue === 0 ? quotedAmount : 0), phone: paymentPhone ? normalizePhone(String(paymentPhone)) : null,
      status: amountDue > 0 ? "awaiting_payment" : "paid", paidAt: amountDue === 0 ? new Date() : null,
    }).$returningId();
    if (creditApplied > 0) await tx.insert(smsWalletTransactionsTable).values({
      pharmacyId, createdBy: auth.user.userId, type: "campaign_credit_applied", amount: String(-creditApplied),
      balanceAfter: walletAfter.balance, reference: `SMS-PURCHASE-${purchaseId}`,
    });
    return { messageId, purchaseId };
  });
  if (amountDue === 0) {
    void processSmsPurchase(created.purchaseId);
    return void res.status(201).json({ ...created, status: "paid", amountDue, creditApplied });
  }
  try {
    const stk = await initiateSmsPurchaseStk(created.purchaseId, String(paymentPhone), amountDue);
    res.status(201).json({ ...created, status: "awaiting_payment", amountDue, creditApplied, ...stk });
  } catch (error: any) {
    await db.update(smsPurchasesTable).set({ status: "payment_failed", failureReason: error.message }).where(eq(smsPurchasesTable.id, created.purchaseId));
    await db.update(messagesTable).set({ status: "payment_failed" }).where(eq(messagesTable.id, created.messageId));
    if (creditApplied > 0) {
      await db.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} + ${creditApplied}` }).where(eq(smsWalletsTable.pharmacyId, pharmacyId));
      const releasedWallet = await ensureWallet(pharmacyId);
      await db.insert(smsWalletTransactionsTable).values({
        pharmacyId, createdBy: auth.user.userId, type: "stk_initiation_credit_release",
        amount: String(creditApplied), balanceAfter: releasedWallet.balance, reference: `SMS-PURCHASE-${created.purchaseId}`,
      });
    }
    res.status(502).json({ error: error.message || "Unable to start SMS payment" });
  }
});

router.post("/", requireManagement, async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const auth = req as AuthenticatedRequest;
  const { title, content, recipientType = "all", dateFrom = null, dateTo = null, paymentPhone } = req.body;
  if (!title || !content || !["all", "this_week", "range"].includes(recipientType)) return void res.status(400).json({ error: "Title, message, and a valid recipient selection are required" });
  if (recipientType === "range" && (!dateFrom || !dateTo)) return void res.status(400).json({ error: "Choose both dates for a custom range" });
  const quote = await quoteCampaign(pharmacyId, { content, recipientType, dateFrom, dateTo });
  if (!quote.canPurchase) return void res.status(400).json({ error: quote.unsupported.length ? `Only GSM-7 messages are supported. Remove: ${quote.unsupported.join(" ")}` : "SMS gateway or billing M-PESA is not ready" });
  if (quote.amountDue > 0 && !paymentPhone) return void res.status(400).json({ error: "Enter the M-PESA phone number for this SMS purchase" });

  const result = await db.transaction(async tx => {
    await tx.insert(smsWalletsTable).values({ pharmacyId }).onDuplicateKeyUpdate({ set: { pharmacyId } });
    if (quote.creditApplied > 0) {
      const debit = await tx.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} - ${quote.creditApplied}` })
        .where(and(eq(smsWalletsTable.pharmacyId, pharmacyId), sql`${smsWalletsTable.balance} >= ${quote.creditApplied}`));
      if (!Number((debit as any)[0]?.affectedRows ?? 0)) throw new Error("SMS credit changed. Refresh the quote and try again.");
    }
    const [walletAfterDebit] = await tx.select().from(smsWalletsTable).where(eq(smsWalletsTable.pharmacyId, pharmacyId));
    const [{ id: messageId }] = await tx.insert(messagesTable).values({
      pharmacyId,
      createdBy: auth.user.userId,
      title: String(title),
      content: String(content),
      recipientType,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`) : null,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`) : null,
      recipientCount: quote.recipientCount,
      characterCount: quote.characterCount,
      segmentCount: quote.segmentCount,
      estimatedCost: String(quote.amountKes),
      status: quote.amountDue > 0 ? "awaiting_payment" : "paid",
    }).$returningId();
    for (const contact of quote.contacts) {
      await tx.insert(messageRecipientsTable).values({
        messageId,
        pharmacyId,
        paymentId: contact.payment.id,
        recipientName: contact.payment.payerName,
        phone: contact.phone,
        status: "queued",
        cost: String(quote.unitsPerRecipient * quote.unitRate),
      });
    }
    const [{ id: purchaseId }] = await tx.insert(smsPurchasesTable).values({
      pharmacyId,
      messageId,
      createdBy: auth.user.userId,
      quotedAmount: String(quote.amountKes),
      creditApplied: String(quote.creditApplied),
      amountDue: String(quote.amountDue),
      paidAmount: String(quote.amountDue === 0 ? quote.amountKes : 0),
      phone: paymentPhone ? normalizePhone(String(paymentPhone)) : null,
      status: quote.amountDue > 0 ? "awaiting_payment" : "paid",
      paidAt: quote.amountDue === 0 ? new Date() : null,
    }).$returningId();
    if (quote.creditApplied > 0) {
      await tx.insert(smsWalletTransactionsTable).values({
        pharmacyId,
        createdBy: auth.user.userId,
        type: "campaign_credit_applied",
        amount: String(-quote.creditApplied),
        balanceAfter: walletAfterDebit.balance,
        reference: `SMS-PURCHASE-${purchaseId}`,
      });
    }
    return { messageId, purchaseId };
  });

  if (quote.amountDue === 0) {
    void processSmsPurchase(result.purchaseId);
    return void res.status(201).json({ purchaseId: result.purchaseId, messageId: result.messageId, status: "paid", amountDue: quote.amountDue, creditApplied: quote.creditApplied, message: "Campaign fully funded by SMS credit and queued for sending" });
  }
  try {
    const stk = await initiateSmsPurchaseStk(result.purchaseId, String(paymentPhone), quote.amountDue);
    res.status(201).json({ purchaseId: result.purchaseId, messageId: result.messageId, status: "awaiting_payment", amountDue: quote.amountDue, creditApplied: quote.creditApplied, ...stk });
  } catch (error: any) {
    await db.update(smsPurchasesTable).set({ status: "payment_failed", failureReason: error.message }).where(eq(smsPurchasesTable.id, result.purchaseId));
    await db.update(messagesTable).set({ status: "payment_failed" }).where(eq(messagesTable.id, result.messageId));
    if (quote.creditApplied > 0) {
      await db.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} + ${quote.creditApplied}` }).where(eq(smsWalletsTable.pharmacyId, pharmacyId));
      const wallet = await ensureWallet(pharmacyId);
      await db.insert(smsWalletTransactionsTable).values({
        pharmacyId,
        createdBy: auth.user.userId,
        type: "stk_initiation_credit_release",
        amount: String(quote.creditApplied),
        balanceAfter: wallet.balance,
        reference: `SMS-PURCHASE-${result.purchaseId}`,
      });
    }
    res.status(502).json({ error: error.message || "Unable to start SMS payment" });
  }
});

export default router;
