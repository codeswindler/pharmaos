import { Router } from "express";
import { db, transactionsTable, productsTable, customersTable } from "@workspace/db";
import { gte, lte, and, eq, desc, sql } from "drizzle-orm";
import { GetRevenueTrendQueryParams, GetTopProductsQueryParams } from "@workspace/api-zod";

const router = Router();

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

router.get("/summary", async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000);

  const allTx = await db.select().from(transactionsTable).where(eq(transactionsTable.status, "completed"));

  const todayTx = allTx.filter((t) => t.createdAt >= todayStart);
  const yesterdayTx = allTx.filter((t) => t.createdAt >= yesterdayStart && t.createdAt < todayStart);
  const weekTx = allTx.filter((t) => t.createdAt >= weekStart);
  const lastWeekTx = allTx.filter((t) => t.createdAt >= lastWeekStart && t.createdAt < weekStart);
  const monthTx = allTx.filter((t) => t.createdAt >= monthStart);

  const sum = (txs: typeof allTx) => txs.reduce((acc, t) => acc + Number(t.totalAmount), 0);

  const todayRevenue = sum(todayTx);
  const yesterdayRevenue = sum(yesterdayTx);
  const weekRevenue = sum(weekTx);
  const lastWeekRevenue = sum(lastWeekTx);
  const monthRevenue = sum(monthTx);

  const todayRevenueChange = yesterdayRevenue > 0
    ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
    : 0;
  const weekRevenueChange = lastWeekRevenue > 0
    ? ((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
    : 0;
  const todayTransactionsChange = yesterdayTx.length > 0
    ? ((todayTx.length - yesterdayTx.length) / yesterdayTx.length) * 100
    : 0;

  const [{ count: totalProducts }] = await db.select({ count: sql<number>`count(*)` }).from(productsTable);
  const [{ count: totalCustomers }] = await db.select({ count: sql<number>`count(*)` }).from(customersTable);

  const allProducts = await db.select().from(productsTable);
  const lowStockCount = allProducts.filter((p) => p.stockQty > 0 && p.stockQty <= p.lowStockThreshold).length;
  const outOfStockCount = allProducts.filter((p) => p.stockQty === 0).length;

  const avgTransactionValue = allTx.length > 0 ? sum(allTx) / allTx.length : 0;

  res.json({
    todayRevenue,
    todayRevenueChange: Math.round(todayRevenueChange * 10) / 10,
    weekRevenue,
    weekRevenueChange: Math.round(weekRevenueChange * 10) / 10,
    monthRevenue,
    todayTransactions: todayTx.length,
    todayTransactionsChange: Math.round(todayTransactionsChange * 10) / 10,
    totalProducts: Number(totalProducts),
    lowStockCount,
    outOfStockCount,
    totalCustomers: Number(totalCustomers),
    avgTransactionValue: Math.round(avgTransactionValue * 100) / 100,
  });
});

router.get("/revenue", async (req, res) => {
  const query = GetRevenueTrendQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const period = query.data.period ?? "week";
  const now = new Date();
  const result: Array<{ label: string; revenue: number; transactions: number }> = [];

  if (period === "today") {
    // Hourly breakdown for today
    const todayStart = startOfDay(now);
    const allTx = await db.select().from(transactionsTable)
      .where(and(gte(transactionsTable.createdAt, todayStart), eq(transactionsTable.status, "completed")));

    for (let h = 0; h <= now.getHours(); h++) {
      const hourTx = allTx.filter((t) => t.createdAt.getHours() === h);
      result.push({
        label: `${h.toString().padStart(2, "0")}:00`,
        revenue: hourTx.reduce((acc, t) => acc + Number(t.totalAmount), 0),
        transactions: hourTx.length,
      });
    }
  } else if (period === "week") {
    // Daily breakdown for last 7 days
    const weekStart = new Date(now.getTime() - 6 * 86400000);
    weekStart.setHours(0, 0, 0, 0);
    const allTx = await db.select().from(transactionsTable)
      .where(and(gte(transactionsTable.createdAt, weekStart), eq(transactionsTable.status, "completed")));
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 86400000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayTx = allTx.filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd);
      result.push({
        label: days[dayStart.getDay()],
        revenue: dayTx.reduce((acc, t) => acc + Number(t.totalAmount), 0),
        transactions: dayTx.length,
      });
    }
  } else {
    // Monthly: weeks breakdown
    const monthStart = startOfMonth(now);
    const allTx = await db.select().from(transactionsTable)
      .where(and(gte(transactionsTable.createdAt, monthStart), eq(transactionsTable.status, "completed")));

    for (let w = 1; w <= 5; w++) {
      const weekStart = new Date(monthStart.getTime() + (w - 1) * 7 * 86400000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
      if (weekStart > now) break;
      const weekTx = allTx.filter((t) => t.createdAt >= weekStart && t.createdAt < weekEnd);
      result.push({
        label: `Wk ${w}`,
        revenue: weekTx.reduce((acc, t) => acc + Number(t.totalAmount), 0),
        transactions: weekTx.length,
      });
    }
  }

  res.json(result);
});

router.get("/low-stock", async (req, res) => {
  const products = await db.select().from(productsTable);
  const lowStock = products.filter((p) => p.stockQty <= p.lowStockThreshold);

  res.json(lowStock.map((p) => ({
    productId: p.id,
    productName: p.name,
    sku: p.sku,
    category: p.category,
    stockQty: p.stockQty,
    lowStockThreshold: p.lowStockThreshold,
    status: p.stockQty === 0 ? "out" : "low",
  })));
});

router.get("/top-products", async (req, res) => {
  const query = GetTopProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const period = query.data.period ?? "week";
  const now = new Date();
  let since: Date;

  if (period === "today") since = startOfDay(now);
  else if (period === "week") since = new Date(now.getTime() - 7 * 86400000);
  else since = startOfMonth(now);

  const allTx = await db.select().from(transactionsTable)
    .where(and(gte(transactionsTable.createdAt, since), eq(transactionsTable.status, "completed")));

  interface ItemAgg {
    productId: number;
    productName: string;
    category: string;
    totalSold: number;
    totalRevenue: number;
  }

  const productMap = new Map<number, ItemAgg>();

  for (const tx of allTx) {
    const items = (tx.items as Array<{ productId: number; productName: string; quantity: number; totalPrice: number }>) || [];
    for (const item of items) {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.totalSold += item.quantity;
        existing.totalRevenue += item.totalPrice;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          category: "",
          totalSold: item.quantity,
          totalRevenue: item.totalPrice,
        });
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  // Enrich with category
  for (const tp of topProducts) {
    const [p] = await db.select({ category: productsTable.category }).from(productsTable).where(eq(productsTable.id, tp.productId));
    if (p) tp.category = p.category;
  }

  res.json(topProducts);
});

router.get("/recent-activity", async (req, res) => {
  const activities: Array<{
    id: number;
    type: string;
    description: string;
    amount: number | null;
    timestamp: string;
  }> = [];

  // Recent transactions
  const recentTx = await db.select().from(transactionsTable)
    .orderBy(desc(transactionsTable.createdAt)).limit(5);
  for (const tx of recentTx) {
    activities.push({
      id: tx.id,
      type: "sale",
      description: `Sale #${tx.id}${tx.customerName ? ` — ${tx.customerName}` : ""}`,
      amount: Number(tx.totalAmount),
      timestamp: tx.createdAt.toISOString(),
    });
  }

  // Low stock alerts
  const products = await db.select().from(productsTable);
  const lowStock = products.filter((p) => p.stockQty <= p.lowStockThreshold).slice(0, 3);
  for (const p of lowStock) {
    activities.push({
      id: p.id + 10000,
      type: "low_stock",
      description: `Low stock: ${p.name} (${p.stockQty} ${p.unit} left)`,
      amount: null,
      timestamp: p.updatedAt.toISOString(),
    });
  }

  // Recent customers
  const recentCustomers = await db.select().from(customersTable)
    .orderBy(desc(customersTable.createdAt)).limit(3);
  for (const c of recentCustomers) {
    activities.push({
      id: c.id + 20000,
      type: "new_customer",
      description: `New customer: ${c.name}`,
      amount: null,
      timestamp: c.createdAt.toISOString(),
    });
  }

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json(activities.slice(0, 15));
});

export default router;
