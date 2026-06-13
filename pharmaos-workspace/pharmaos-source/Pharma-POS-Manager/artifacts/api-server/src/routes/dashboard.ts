import { Router } from "express";
import { db, checkoutItemsTable, checkoutsTable, productsTable } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { getPharmacyId } from "../middleware/auth";

const router = Router();
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

router.get("/summary", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
  const monthStart = startOfMonth(now);
  const all = await db.select().from(checkoutsTable).where(and(eq(checkoutsTable.pharmacyId, pharmacyId), eq(checkoutsTable.status, "completed")));
  const sum = (rows: typeof all) => rows.reduce((total, row) => total + Number(row.totalAmount), 0);
  const today = all.filter(row => row.completedAt && row.completedAt >= todayStart);
  const yesterday = all.filter(row => row.completedAt && row.completedAt >= yesterdayStart && row.completedAt < todayStart);
  const week = all.filter(row => row.completedAt && row.completedAt >= weekStart);
  const lastWeek = all.filter(row => row.completedAt && row.completedAt >= lastWeekStart && row.completedAt < weekStart);
  const month = all.filter(row => row.completedAt && row.completedAt >= monthStart);
  const products = await db.select().from(productsTable).where(eq(productsTable.pharmacyId, pharmacyId));
  const percent = (current: number, prior: number) => prior ? Math.round(((current - prior) / prior) * 1000) / 10 : 0;
  res.json({
    todayRevenue: sum(today), todayRevenueChange: percent(sum(today), sum(yesterday)),
    weekRevenue: sum(week), weekRevenueChange: percent(sum(week), sum(lastWeek)),
    monthRevenue: sum(month), todayTransactions: today.length, todayTransactionsChange: percent(today.length, yesterday.length),
    totalProducts: products.length,
    lowStockCount: products.filter(p => p.stockQty - p.reservedQty > 0 && p.stockQty - p.reservedQty <= p.lowStockThreshold).length,
    outOfStockCount: products.filter(p => p.stockQty - p.reservedQty <= 0).length,
    avgTransactionValue: all.length ? sum(all) / all.length : 0,
  });
});

router.get("/revenue", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const now = new Date();
  const since = new Date(now.getTime() - 6 * 86400000);
  since.setHours(0, 0, 0, 0);
  const rows = await db.select().from(checkoutsTable).where(and(
    eq(checkoutsTable.pharmacyId, pharmacyId), eq(checkoutsTable.status, "completed"), gte(checkoutsTable.completedAt, since),
  ));
  const result = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(since.getTime() + offset * 86400000);
    const end = new Date(day.getTime() + 86400000);
    const matches = rows.filter(row => row.completedAt && row.completedAt >= day && row.completedAt < end);
    return { label: day.toLocaleDateString("en-KE", { weekday: "short" }), revenue: matches.reduce((sum, row) => sum + Number(row.totalAmount), 0), transactions: matches.length };
  });
  res.json(result);
});

router.get("/low-stock", async (req, res) => {
  const rows = await db.select().from(productsTable).where(eq(productsTable.pharmacyId, getPharmacyId(req)));
  res.json(rows.filter(p => p.stockQty - p.reservedQty <= p.lowStockThreshold).map(p => ({
    productId: p.id, productName: p.name, sku: p.sku, category: p.category,
    stockQty: p.stockQty - p.reservedQty, lowStockThreshold: p.lowStockThreshold,
    status: p.stockQty - p.reservedQty <= 0 ? "out" : "low",
  })));
});

router.get("/top-products", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const completed = await db.select({ id: checkoutsTable.id }).from(checkoutsTable).where(and(eq(checkoutsTable.pharmacyId, pharmacyId), eq(checkoutsTable.status, "completed")));
  const ids = new Set(completed.map(row => row.id));
  const items = await db.select().from(checkoutItemsTable);
  const products = await db.select().from(productsTable).where(eq(productsTable.pharmacyId, pharmacyId));
  const categories = new Map(products.map(p => [p.id, p.category]));
  const aggregate = new Map<number, { productId: number; productName: string; category: string; totalSold: number; totalRevenue: number }>();
  for (const item of items.filter(item => ids.has(item.checkoutId))) {
    const current = aggregate.get(item.productId) ?? { productId: item.productId, productName: item.productName, category: categories.get(item.productId) ?? "", totalSold: 0, totalRevenue: 0 };
    current.totalSold += item.quantity;
    current.totalRevenue += Number(item.totalPrice);
    aggregate.set(item.productId, current);
  }
  res.json([...aggregate.values()].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10));
});

router.get("/recent-activity", async (req, res) => {
  const pharmacyId = getPharmacyId(req);
  const checkouts = await db.select().from(checkoutsTable).where(eq(checkoutsTable.pharmacyId, pharmacyId)).orderBy(desc(checkoutsTable.createdAt)).limit(10);
  res.json(checkouts.map(row => ({
    id: row.id, type: "sale", description: `Checkout #${row.id} ${row.status}`,
    amount: Number(row.totalAmount), timestamp: row.createdAt.toISOString(),
  })));
});

export default router;
