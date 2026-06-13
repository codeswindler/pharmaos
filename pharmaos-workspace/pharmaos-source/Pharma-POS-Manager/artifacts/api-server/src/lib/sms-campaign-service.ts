import {
  db,
  messagesTable,
  messageRecipientsTable,
  smsPurchasesTable,
  smsWalletsTable,
  smsWalletTransactionsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { sendPlatformSms } from "./platform-sms";

export async function processSmsPurchase(purchaseId: number) {
  const [purchase] = await db.select().from(smsPurchasesTable).where(eq(smsPurchasesTable.id, purchaseId));
  if (!purchase || purchase.status !== "paid") return;

  const claimResult = await db.update(smsPurchasesTable).set({ status: "processing", processingStartedAt: new Date() })
    .where(and(eq(smsPurchasesTable.id, purchaseId), eq(smsPurchasesTable.status, "paid")));
  if (!Number((claimResult as any)[0]?.affectedRows ?? 0)) return;

  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, purchase.messageId));
  if (!message) {
    await db.update(smsPurchasesTable).set({ status: "failed", failureReason: "Campaign not found" }).where(eq(smsPurchasesTable.id, purchaseId));
    return;
  }

  await db.update(messagesTable).set({ status: "processing" }).where(eq(messagesTable.id, message.id));
  const recipients = await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.messageId, message.id));
  for (const recipient of recipients) {
    if (["sent", "delivered", "failed"].includes(recipient.status)) continue;
    let payload: unknown = {};
    let parsed = { success: false, responseCode: "", responseDescription: "Gateway request failed", providerMessageId: null as string | null, networkId: null as string | null };
    try {
      ({ payload, parsed } = await sendPlatformSms(recipient.phone, message.content, Boolean(recipient.isHashed)));
    } catch (error: any) {
      parsed.responseDescription = error.message || "Gateway request failed";
      logger.error({ err: error, purchaseId, messageId: message.id }, "SMS provider request failed");
    }
    await db.update(messageRecipientsTable).set({
      providerMessageId: parsed.providerMessageId,
      providerNetworkId: parsed.networkId,
      responseCode: parsed.responseCode,
      responseDescription: parsed.responseDescription,
      status: parsed.success ? "sent" : "failed",
      rawResponse: JSON.stringify(payload),
      sentAt: parsed.success ? new Date() : null,
      failedAt: parsed.success ? null : new Date(),
      creditReturnedAt: parsed.success ? null : new Date(),
    }).where(eq(messageRecipientsTable.id, recipient.id));
  }

  const finalRecipients = await db.select().from(messageRecipientsTable).where(eq(messageRecipientsTable.messageId, message.id));
  const successful = finalRecipients.filter(row => ["sent", "delivered"].includes(row.status)).length;
  const failed = finalRecipients.filter(row => row.status === "failed").length;
  const refundCredit = finalRecipients.filter(row => row.status === "failed").reduce((sum, row) => sum + Number(row.cost), 0);
  const status = failed === finalRecipients.length ? "failed" : failed ? "partially_failed" : "sent";
  await db.transaction(async tx => {
    if (refundCredit > 0 && Number(purchase.refundCredit) === 0) {
      await tx.insert(smsWalletsTable).values({ pharmacyId: purchase.pharmacyId }).onDuplicateKeyUpdate({ set: { pharmacyId: purchase.pharmacyId } });
      await tx.update(smsWalletsTable).set({ balance: sql`${smsWalletsTable.balance} + ${refundCredit}` }).where(eq(smsWalletsTable.pharmacyId, purchase.pharmacyId));
      const [wallet] = await tx.select().from(smsWalletsTable).where(eq(smsWalletsTable.pharmacyId, purchase.pharmacyId));
      await tx.insert(smsWalletTransactionsTable).values({
        pharmacyId: purchase.pharmacyId,
        createdBy: purchase.createdBy,
        type: "failed_send_credit",
        amount: String(refundCredit),
        balanceAfter: wallet.balance,
        reference: `SMS-PURCHASE-${purchase.id}`,
      });
    }
    await tx.update(messagesTable).set({
      sentCount: successful,
      failedCount: failed,
      actualCost: String(Math.max(0, Number(purchase.quotedAmount) - refundCredit)),
      status,
      sentAt: new Date(),
    }).where(eq(messagesTable.id, message.id));
    await tx.update(smsPurchasesTable).set({
      status: "completed",
      refundCredit: String(refundCredit),
      completedAt: new Date(),
    }).where(eq(smsPurchasesTable.id, purchase.id));
  });
}

export async function resumePaidSmsPurchases() {
  const processing = await db.select().from(smsPurchasesTable).where(eq(smsPurchasesTable.status, "processing"));
  for (const purchase of processing) {
    await db.update(smsPurchasesTable).set({ status: "paid" }).where(eq(smsPurchasesTable.id, purchase.id));
  }
  const paid = await db.select().from(smsPurchasesTable).where(eq(smsPurchasesTable.status, "paid"));
  for (const purchase of paid) void processSmsPurchase(purchase.id);
}
