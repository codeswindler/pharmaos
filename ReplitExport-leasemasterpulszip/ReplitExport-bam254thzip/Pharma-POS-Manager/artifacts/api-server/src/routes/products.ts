import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, ilike, or, lte, and } from "drizzle-orm";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { search, category, lowStock } = query.data;

  const conditions: ReturnType<typeof eq>[] = [];
  if (category) conditions.push(eq(productsTable.category, category));
  if (lowStock === true || lowStock === "true" as unknown) {
    // We'll filter in JS after fetching
  }

  let rows = await db.select().from(productsTable).where(
    conditions.length ? and(...conditions) : undefined
  );

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        (p.barcode?.toLowerCase().includes(s) ?? false)
    );
  }

  if (lowStock === true || (lowStock as unknown) === "true") {
    rows = rows.filter((p) => p.stockQty <= p.lowStockThreshold);
  }

  const result = rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    description: p.description,
    category: p.category,
    price: Number(p.price),
    costPrice: p.costPrice ? Number(p.costPrice) : null,
    stockQty: p.stockQty,
    lowStockThreshold: p.lowStockThreshold,
    unit: p.unit,
    manufacturer: p.manufacturer,
    expiryDate: p.expiryDate,
    requiresPrescription: p.requiresPrescription,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/", async (req, res) => {
  const body = CreateProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    ...body.data,
    price: String(body.data.price),
    costPrice: body.data.costPrice ? String(body.data.costPrice) : null,
  }).returning();

  res.status(201).json({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    category: product.category,
    price: Number(product.price),
    costPrice: product.costPrice ? Number(product.costPrice) : null,
    stockQty: product.stockQty,
    lowStockThreshold: product.lowStockThreshold,
    unit: product.unit,
    manufacturer: product.manufacturer,
    expiryDate: product.expiryDate,
    requiresPrescription: product.requiresPrescription,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
  });
});

router.get("/categories", async (req, res) => {
  const rows = await db.selectDistinct({ category: productsTable.category }).from(productsTable);
  res.json(rows.map((r) => r.category).filter(Boolean).sort());
});

router.get("/:id", async (req, res) => {
  const params = GetProductParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    category: product.category,
    price: Number(product.price),
    costPrice: product.costPrice ? Number(product.costPrice) : null,
    stockQty: product.stockQty,
    lowStockThreshold: product.lowStockThreshold,
    unit: product.unit,
    manufacturer: product.manufacturer,
    expiryDate: product.expiryDate,
    requiresPrescription: product.requiresPrescription,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
  });
});

router.patch("/:id", async (req, res) => {
  const params = UpdateProductParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const updateData: Record<string, unknown> = { ...body.data };
  if (body.data.price !== undefined) updateData.price = String(body.data.price);
  if (body.data.costPrice !== undefined) updateData.costPrice = body.data.costPrice ? String(body.data.costPrice) : null;

  const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    category: product.category,
    price: Number(product.price),
    costPrice: product.costPrice ? Number(product.costPrice) : null,
    stockQty: product.stockQty,
    lowStockThreshold: product.lowStockThreshold,
    unit: product.unit,
    manufacturer: product.manufacturer,
    expiryDate: product.expiryDate,
    requiresPrescription: product.requiresPrescription,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const params = DeleteProductParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
