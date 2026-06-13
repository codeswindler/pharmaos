import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  ListInventoryQueryParams,
  AdjustStockParams,
  AdjustStockBody,
} from "@workspace/api-zod";
import { getPharmacyId, requireManagement } from "../middleware/auth";

const router = Router();

function getStockStatus(qty: number, threshold: number): "ok" | "low" | "out" {
  if (qty === 0) return "out";
  if (qty <= threshold) return "low";
  return "ok";
}

router.get("/", async (req, res) => {
  const query = ListInventoryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  let rows = await db.select().from(productsTable).where(eq(productsTable.pharmacyId, getPharmacyId(req))).orderBy(productsTable.name);

  if (query.data.lowStock === true || (query.data.lowStock as unknown) === "true") {
    rows = rows.filter((p) => p.stockQty <= p.lowStockThreshold);
  }

  res.json(rows.map((p) => ({
    productId: p.id,
    productName: p.name,
    sku: p.sku,
    category: p.category,
    stockQty: p.stockQty,
    lowStockThreshold: p.lowStockThreshold,
    unit: p.unit,
    lastUpdated: p.updatedAt.toISOString(),
    status: getStockStatus(p.stockQty, p.lowStockThreshold),
  })));
});

router.post("/:productId/adjust", requireManagement, async (req, res) => {
  const params = AdjustStockParams.safeParse({ productId: Number(req.params.productId) });
  const body = AdjustStockBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const scope = and(eq(productsTable.id, params.data.productId), eq(productsTable.pharmacyId, getPharmacyId(req)));
  const [product] = await db.select().from(productsTable).where(scope);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  let newQty = product.stockQty;
  if (body.data.type === "add") newQty += body.data.quantity;
  else if (body.data.type === "subtract") newQty = Math.max(0, newQty - body.data.quantity);
  else if (body.data.type === "set") newQty = body.data.quantity;

  await db.update(productsTable)
    .set({ stockQty: newQty })
    .where(scope);
  const [updated] = await db.select().from(productsTable).where(scope);

  res.json({
    productId: updated.id,
    productName: updated.name,
    sku: updated.sku,
    category: updated.category,
    stockQty: updated.stockQty,
    lowStockThreshold: updated.lowStockThreshold,
    unit: updated.unit,
    lastUpdated: updated.updatedAt.toISOString(),
    status: getStockStatus(updated.stockQty, updated.lowStockThreshold),
  });
});

export default router;
