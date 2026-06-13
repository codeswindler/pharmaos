import { db, checkoutItemsTable, checkoutsTable, paymentsTable, productsTable } from "@workspace/db";
import { and, eq, lt, sql } from "drizzle-orm";

export async function releaseReservation(checkoutId: number) {
  const items = await db.select().from(checkoutItemsTable).where(eq(checkoutItemsTable.checkoutId, checkoutId));
  for (const item of items) {
    await db.update(productsTable).set({
      reservedQty: sql`GREATEST(0, ${productsTable.reservedQty} - ${item.quantity})`,
    }).where(eq(productsTable.id, item.productId));
  }
}

export async function expireStaleCheckouts(pharmacyId?: number) {
  const conditions = [eq(checkoutsTable.status, "open"), eq(checkoutsTable.paidAmount, "0"), lt(checkoutsTable.expiresAt, new Date())];
  if (pharmacyId) conditions.push(eq(checkoutsTable.pharmacyId, pharmacyId));
  const stale = await db.select().from(checkoutsTable).where(and(...conditions));
  for (const checkout of stale) {
    await releaseReservation(checkout.id);
    await db.update(checkoutsTable).set({ status: "expired", cancelledAt: new Date() }).where(eq(checkoutsTable.id, checkout.id));
  }
  return stale.length;
}

export async function refreshCheckout(checkoutId: number) {
  const [checkout] = await db.select().from(checkoutsTable).where(eq(checkoutsTable.id, checkoutId));
  if (!checkout) return null;
  const payments = await db.select().from(paymentsTable).where(and(
    eq(paymentsTable.checkoutId, checkoutId),
    eq(paymentsTable.status, "attached"),
  ));
  const paid = payments.reduce((sum, payment) => sum + Number(payment.appliedAmount), 0);
  const total = Number(checkout.totalAmount);
  const balance = Math.max(0, total - paid);
  const change = payments.reduce((sum, payment) => sum + Number(payment.changeAmount), 0);
  const wasOpen = checkout.status === "open";
  const status = balance === 0 && wasOpen ? "completed" : checkout.status;
  await db.update(checkoutsTable).set({
    paidAmount: String(paid), balanceAmount: String(balance), changeAmount: String(change),
    status, ...(status === "completed" && wasOpen ? { completedAt: new Date() } : {}),
  }).where(eq(checkoutsTable.id, checkoutId));
  if (status === "completed" && wasOpen) {
    const items = await db.select().from(checkoutItemsTable).where(eq(checkoutItemsTable.checkoutId, checkoutId));
    for (const item of items) {
      await db.update(productsTable).set({
        stockQty: sql`GREATEST(0, ${productsTable.stockQty} - ${item.quantity})`,
        reservedQty: sql`GREATEST(0, ${productsTable.reservedQty} - ${item.quantity})`,
      }).where(eq(productsTable.id, item.productId));
    }
  }
  return (await db.select().from(checkoutsTable).where(eq(checkoutsTable.id, checkoutId)))[0];
}
