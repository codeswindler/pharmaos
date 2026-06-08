import { Router } from "express";
import { db, customersTable, transactionsTable } from "@workspace/db";
import { eq, ilike, desc } from "drizzle-orm";
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  UpdateCustomerBody,
  GetCustomerTransactionsParams,
} from "@workspace/api-zod";

const router = Router();

function formatCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    loyaltyPoints: c.loyaltyPoints,
    totalSpend: Number(c.totalSpend),
    visitCount: c.visitCount,
    createdAt: c.createdAt.toISOString(),
    lastVisit: c.lastVisit ? c.lastVisit.toISOString() : null,
  };
}

router.get("/", async (req, res) => {
  const query = ListCustomersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  let rows = await db.select().from(customersTable).orderBy(desc(customersTable.createdAt));

  if (query.data.search) {
    const s = query.data.search.toLowerCase();
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.phone?.toLowerCase().includes(s) ?? false) ||
        (c.email?.toLowerCase().includes(s) ?? false)
    );
  }

  res.json(rows.map(formatCustomer));
});

router.post("/", async (req, res) => {
  const body = CreateCustomerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }

  const [customer] = await db.insert(customersTable).values(body.data).returning();
  res.status(201).json(formatCustomer(customer));
});

router.get("/:id", async (req, res) => {
  const params = GetCustomerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(formatCustomer(customer));
});

router.patch("/:id", async (req, res) => {
  const params = UpdateCustomerParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateCustomerBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [customer] = await db.update(customersTable).set(body.data).where(eq(customersTable.id, params.data.id)).returning();
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(formatCustomer(customer));
});

router.get("/:id/transactions", async (req, res) => {
  const params = GetCustomerTransactionsParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.customerId, params.data.id))
    .orderBy(desc(transactionsTable.createdAt));

  res.json(rows.map((t) => ({
    id: t.id,
    customerId: t.customerId,
    customerName: t.customerName,
    totalAmount: Number(t.totalAmount),
    discountAmount: Number(t.discountAmount),
    taxAmount: Number(t.taxAmount),
    paidAmount: Number(t.paidAmount),
    changeAmount: Number(t.changeAmount),
    status: t.status,
    paymentMethod: t.paymentMethod,
    referenceCode: t.referenceCode,
    validationCode: t.validationCode,
    isValidated: t.isValidated,
    receiptPrinted: t.receiptPrinted,
    createdAt: t.createdAt.toISOString(),
    items: t.items as unknown[],
  })));
});

export default router;
