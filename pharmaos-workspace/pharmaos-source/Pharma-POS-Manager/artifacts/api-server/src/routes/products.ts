import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
} from "@workspace/api-zod";
import { getPharmacyId, requireManagement } from "../middleware/auth";

const router = Router();

const cleanOptional = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const productValues = (data: Record<string, any>) => ({
  ...data,
  barcode: cleanOptional(data.barcode),
  description: cleanOptional(data.description),
  manufacturer: cleanOptional(data.manufacturer),
  expiryDate: cleanOptional(data.expiryDate),
  costPrice: data.costPrice ? String(data.costPrice) : null,
  ...(data.price !== undefined && { price: String(data.price) }),
});

router.get("/", async (req, res) => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { search, category, lowStock } = query.data;
  const pharmacyId = getPharmacyId(req);

  const conditions: ReturnType<typeof eq>[] = [eq(productsTable.pharmacyId, pharmacyId)];
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
    stockQty: p.stockQty - p.reservedQty,
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

router.post("/", requireManagement, async (req, res) => {
  const body = CreateProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }

  const pharmacyId = getPharmacyId(req);
  const values = {
    pharmacyId,
    ...productValues(body.data),
  } as any;
  const [{ id }] = await db.insert(productsTable).values(values).$returningId();
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));

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
  const rows = await db.selectDistinct({ category: productsTable.category }).from(productsTable).where(eq(productsTable.pharmacyId, getPharmacyId(req)));
  res.json(rows.map((r) => r.category).filter(Boolean).sort());
});

router.get("/:id", async (req, res) => {
  const params = GetProductParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, params.data.id), eq(productsTable.pharmacyId, getPharmacyId(req))));
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

router.patch("/:id", requireManagement, async (req, res) => {
  const params = UpdateProductParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const updateData: Record<string, unknown> = productValues(body.data);

  const scope = and(eq(productsTable.id, params.data.id), eq(productsTable.pharmacyId, getPharmacyId(req)));
  await db.update(productsTable).set(updateData).where(scope);
  const [product] = await db.select().from(productsTable).where(scope);
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

router.delete("/:id", requireManagement, async (req, res) => {
  const params = DeleteProductParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(productsTable).where(and(eq(productsTable.id, params.data.id), eq(productsTable.pharmacyId, getPharmacyId(req))));
  res.status(204).send();
});

export default router;
