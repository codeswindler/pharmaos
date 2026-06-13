import { Router } from "express";
import { db, checkoutItemsTable, checkoutsTable, paymentsTable, productsTable, pharmaciesTable, usersTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { expireStaleCheckouts, refreshCheckout, releaseReservation } from "../lib/checkout-service";
import { getPharmacyId, requireManagement, type AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const checkoutDetails = async (id: number, pharmacyId: number) => {
  const [checkout] = await db.select().from(checkoutsTable).where(and(eq(checkoutsTable.id, id), eq(checkoutsTable.pharmacyId, pharmacyId)));
  if (!checkout) return null;
  const items = await db.select().from(checkoutItemsTable).where(eq(checkoutItemsTable.checkoutId, id));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.checkoutId, id)).orderBy(paymentsTable.receivedAt);
  return {
    ...checkout, subtotal: Number(checkout.subtotal), discountAmount: Number(checkout.discountAmount),
    totalAmount: Number(checkout.totalAmount), paidAmount: Number(checkout.paidAmount),
    balanceAmount: Number(checkout.balanceAmount), changeAmount: Number(checkout.changeAmount),
    items: items.map(i => ({ ...i, unitPrice: Number(i.unitPrice), totalPrice: Number(i.totalPrice) })),
    payments: payments.map(p => ({ ...p, amount: Number(p.amount), appliedAmount: Number(p.appliedAmount), changeAmount: Number(p.changeAmount) })),
  };
};

router.get("/", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  await expireStaleCheckouts(pharmacyId);
  const rows = await db.select().from(checkoutsTable).where(eq(checkoutsTable.pharmacyId, pharmacyId)).orderBy(desc(checkoutsTable.createdAt));
  res.json(rows.map(row => ({ ...row, totalAmount: Number(row.totalAmount), paidAmount: Number(row.paidAmount), balanceAmount: Number(row.balanceAmount) })));
});

router.post("/expire", async (req, res) => {
  const expired = await expireStaleCheckouts(getPharmacyId(req));
  res.json({ expired });
});

router.post("/", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const cashierId = (req as AuthenticatedRequest).user.userId;
  const { items, customerId = null, customerName = null, discountAmount = 0 } = req.body as {
    items: Array<{ productId: number; quantity: number }>; customerId?: number; customerName?: string; discountAmount?: number;
  };
  if (!Array.isArray(items) || items.length === 0) return void res.status(400).json({ error: "Basket items are required" });
  const details = [];
  let subtotal = 0;
  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, item.productId), eq(productsTable.pharmacyId, pharmacyId)));
    if (!product || item.quantity <= 0) return void res.status(400).json({ error: `Invalid product ${item.productId}` });
    if (product.stockQty - product.reservedQty < item.quantity) return void res.status(409).json({ error: `Insufficient available stock for ${product.name}` });
    const totalPrice = Number(product.price) * item.quantity;
    subtotal += totalPrice;
    details.push({ product, quantity: item.quantity, totalPrice });
  }
  const total = Math.max(0, subtotal - Number(discountAmount));
  const [{ id }] = await db.insert(checkoutsTable).values({
    pharmacyId, cashierId, customerId, customerName, subtotal: String(subtotal),
    discountAmount: String(discountAmount), totalAmount: String(total), balanceAmount: String(total),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  }).$returningId();
  for (const item of details) {
    await db.insert(checkoutItemsTable).values({
      checkoutId: id, productId: item.product.id, productName: item.product.name, sku: item.product.sku,
      quantity: item.quantity, unitPrice: item.product.price, totalPrice: String(item.totalPrice),
    });
    await db.update(productsTable).set({ reservedQty: sql`${productsTable.reservedQty} + ${item.quantity}` }).where(eq(productsTable.id, item.product.id));
  }
  res.status(201).json(await checkoutDetails(id, pharmacyId));
});

router.get("/:id", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  await expireStaleCheckouts(pharmacyId);
  const checkout = await checkoutDetails(Number(req.params.id), pharmacyId);
  if (!checkout) return void res.status(404).json({ error: "Checkout not found" });
  res.json(checkout);
});

router.post("/:id/cancel", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const id = Number(req.params.id);
  const checkout = await checkoutDetails(id, pharmacyId);
  if (!checkout) return void res.status(404).json({ error: "Checkout not found" });
  if (checkout.payments.some(payment => payment.status === "attached")) return void res.status(409).json({ error: "Paid checkouts require manager voiding" });
  if (checkout.status === "open") await releaseReservation(id);
  await db.update(checkoutsTable).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(checkoutsTable.id, id));
  res.json(await checkoutDetails(id, pharmacyId));
});

router.post("/:id/void", requireManagement, async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const id = Number(req.params.id);
  const checkout = await checkoutDetails(id, pharmacyId);
  if (!checkout) return void res.status(404).json({ error: "Checkout not found" });
  if (checkout.status === "open") await releaseReservation(id);
  if (checkout.status === "completed") {
    for (const item of checkout.items) {
      await db.update(productsTable).set({ stockQty: sql`${productsTable.stockQty} + ${item.quantity}` }).where(eq(productsTable.id, item.productId));
    }
  }
  await db.update(paymentsTable).set({ status: "refund_required" }).where(and(eq(paymentsTable.checkoutId, id), eq(paymentsTable.status, "attached")));
  await db.update(checkoutsTable).set({ status: "voided", voidedAt: new Date() }).where(eq(checkoutsTable.id, id));
  res.json(await checkoutDetails(id, pharmacyId));
});

router.get("/:id/receipt", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const checkout = await checkoutDetails(Number(req.params.id), pharmacyId);
  if (!checkout) return void res.status(404).json({ error: "Checkout not found" });
  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
  const [cashier] = await db.select().from(usersTable).where(eq(usersTable.id, checkout.cashierId));
  res.json({ ...checkout, pharmacy, cashierName: cashier?.name ?? "Cashier" });
});

export default router;
