import { Router } from "express";
import { db, transactionsTable, productsTable, customersTable } from "@workspace/db";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import {
  ListTransactionsQueryParams,
  CreateTransactionBody,
  GetTransactionParams,
  ConfirmPaymentParams,
  ConfirmPaymentBody,
  RequestValidationCodeParams,
  ValidateTransactionCodeParams,
  ValidateTransactionCodeBody,
  GetReceiptParams,
} from "@workspace/api-zod";

const router = Router();

interface StoredItem {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

function formatTransaction(t: typeof transactionsTable.$inferSelect) {
  return {
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
    items: (t.items as StoredItem[]) || [],
  };
}

// ─── M-PESA Integration ────────────────────────────────────────────────────────

interface MpesaPaymentStatus {
  status: "pending" | "completed" | "failed" | "cancelled";
  payerName?: string;
  payerPhone?: string;
  amount?: number;
  mpesaReceiptNumber?: string;
}

const mpesaPayments = new Map<string, MpesaPaymentStatus>();

const MPESA_BASE_URL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

async function getMpesaAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("M-PESA credentials not configured (MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET)");

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`M-PESA auth failed: ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function sendSTKPush(phone: string, amount: number, accountRef: string): Promise<{ CheckoutRequestID: string }> {
  const token = await getMpesaAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE || "174379";
  const passkey =
    process.env.MPESA_PASSKEY ||
    "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  const callbackBase =
    process.env.MPESA_CALLBACK_URL ||
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/transactions/mpesa/callback`
      : "https://example.com/api/transactions/mpesa/callback");

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.ceil(amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackBase,
    AccountReference: accountRef.slice(0, 12),
    TransactionDesc: "PharmaPOS Payment",
  };

  const res = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`STK Push failed: ${text}`);
  }

  const data = (await res.json()) as any;
  if (data.ResponseCode !== "0") {
    throw new Error(data.ResponseDescription || "STK Push rejected");
  }

  return { CheckoutRequestID: data.CheckoutRequestID };
}

router.post("/mpesa/initiate", async (req, res) => {
  const { phone, amount, accountRef } = req.body as {
    phone: string;
    amount: number;
    accountRef?: string;
  };

  if (!phone || !amount) {
    res.status(400).json({ error: "phone and amount are required" });
    return;
  }

  const normalised = String(phone).replace(/^(0|\+?254)/, "254").replace(/\D/g, "");
  if (normalised.length < 12) {
    res.status(400).json({ error: "Invalid phone number. Use format: 254XXXXXXXXX" });
    return;
  }

  try {
    const result = await sendSTKPush(normalised, amount, accountRef || "PharmaPOS");
    const id = result.CheckoutRequestID;
    mpesaPayments.set(id, { status: "pending" });
    res.json({ checkoutRequestId: id, message: "STK Push sent successfully" });
  } catch (err: any) {
    res.status(502).json({ error: err.message || "Failed to initiate M-PESA payment" });
  }
});

router.post("/mpesa/callback", (req, res) => {
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) {
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    const checkoutRequestId: string = stkCallback.CheckoutRequestID;
    const resultCode: number = stkCallback.ResultCode;

    if (resultCode === 0) {
      const items: Array<{ Name: string; Value: any }> =
        stkCallback.CallbackMetadata?.Item || [];
      const get = (name: string) => items.find((i) => i.Name === name)?.Value;

      const amount = Number(get("Amount")) || undefined;
      const receipt = String(get("MpesaReceiptNumber") || "");
      const phone = String(get("PhoneNumber") || "");
      const firstName = String(get("FirstName") || "").trim();
      const middleName = String(get("MiddleName") || "").trim();
      const lastName = String(get("LastName") || "").trim();
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

      mpesaPayments.set(checkoutRequestId, {
        status: "completed",
        payerName: fullName || undefined,
        payerPhone: phone,
        amount,
        mpesaReceiptNumber: receipt,
      });
    } else if (resultCode === 1032) {
      mpesaPayments.set(checkoutRequestId, { status: "cancelled" });
    } else {
      mpesaPayments.set(checkoutRequestId, { status: "failed" });
    }
  } catch {
    // Always ACK Safaricom
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.get("/mpesa/status/:checkoutRequestId", (req, res) => {
  const { checkoutRequestId } = req.params;
  const payment = mpesaPayments.get(checkoutRequestId);
  if (!payment) {
    res.json({ status: "pending" });
    return;
  }
  res.json(payment);
});

// ─── Standard Transaction Routes ───────────────────────────────────────────────

router.get("/recent", async (req, res) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await db.select().from(transactionsTable)
    .where(gte(transactionsTable.createdAt, oneHourAgo))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(20);
  res.json(rows.map(formatTransaction));
});

router.get("/", async (req, res) => {
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const conditions = [];
  if (query.data.from) conditions.push(gte(transactionsTable.createdAt, new Date(query.data.from)));
  if (query.data.to) conditions.push(lte(transactionsTable.createdAt, new Date(query.data.to + "T23:59:59Z")));
  if (query.data.status) conditions.push(eq(transactionsTable.status, query.data.status));

  const rows = await db.select().from(transactionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transactionsTable.createdAt));

  res.json(rows.map(formatTransaction));
});

router.post("/", async (req, res) => {
  const body = CreateTransactionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }

  const itemDetails: StoredItem[] = [];
  let subtotal = 0;

  for (const item of body.data.items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!product) {
      res.status(400).json({ error: `Product ${item.productId} not found` });
      return;
    }
    if (product.stockQty < item.quantity) {
      res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      return;
    }
    const unitPrice = Number(product.price);
    const totalPrice = unitPrice * item.quantity;
    subtotal += totalPrice;
    itemDetails.push({ productId: product.id, productName: product.name, sku: product.sku, quantity: item.quantity, unitPrice, totalPrice });
  }

  const discountAmount = body.data.discountAmount ?? 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const paidAmount = body.data.paidAmount;
  const changeAmount = Math.max(0, paidAmount - totalAmount);

  for (const item of itemDetails) {
    await db.update(productsTable)
      .set({ stockQty: sql`${productsTable.stockQty} - ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
  }

  let customerName = body.data.customerName ?? null;
  if (body.data.customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, body.data.customerId));
    if (customer) {
      customerName = customer.name;
      await db.update(customersTable).set({
        visitCount: customer.visitCount + 1,
        totalSpend: String(Number(customer.totalSpend) + totalAmount),
        loyaltyPoints: customer.loyaltyPoints + Math.floor(totalAmount),
        lastVisit: new Date(),
      }).where(eq(customersTable.id, body.data.customerId));
    }
  }

  const [transaction] = await db.insert(transactionsTable).values({
    customerId: body.data.customerId ?? null,
    customerName,
    totalAmount: String(totalAmount),
    discountAmount: String(discountAmount),
    taxAmount: "0",
    paidAmount: String(paidAmount),
    changeAmount: String(changeAmount),
    status: "completed",
    paymentMethod: body.data.paymentMethod,
    referenceCode: body.data.referenceCode ?? null,
    isValidated: false,
    receiptPrinted: false,
    items: itemDetails,
  }).returning();

  res.status(201).json(formatTransaction(transaction));
});

router.get("/:id", async (req, res) => {
  const params = GetTransactionParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, params.data.id));
  if (!t) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json(formatTransaction(t));
});

router.post("/:id/confirm-payment", async (req, res) => {
  const params = ConfirmPaymentParams.safeParse({ id: Number(req.params.id) });
  const body = ConfirmPaymentBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const updateData: Record<string, unknown> = { isValidated: body.data.confirmed };
  if (body.data.customerName) updateData.customerName = body.data.customerName;
  if (body.data.customerId) updateData.customerId = body.data.customerId;

  const [t] = await db.update(transactionsTable).set(updateData)
    .where(eq(transactionsTable.id, params.data.id)).returning();
  if (!t) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json(formatTransaction(t));
});

router.post("/:id/request-validation-code", async (req, res) => {
  const params = RequestValidationCodeParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await db.update(transactionsTable).set({ validationCode: code }).where(eq(transactionsTable.id, params.data.id));
  res.json({ message: "Validation code generated.", code, expiresIn: 300 });
});

router.post("/:id/validate-code", async (req, res) => {
  const params = ValidateTransactionCodeParams.safeParse({ id: Number(req.params.id) });
  const body = ValidateTransactionCodeBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, params.data.id));
  if (!t) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (t.validationCode !== body.data.code) { res.status(400).json({ error: "Invalid validation code" }); return; }

  const [updated] = await db.update(transactionsTable)
    .set({ isValidated: true })
    .where(eq(transactionsTable.id, params.data.id))
    .returning();
  res.json(formatTransaction(updated));
});

router.get("/:id/receipt", async (req, res) => {
  const params = GetReceiptParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, params.data.id));
  if (!t) { res.status(404).json({ error: "Transaction not found" }); return; }

  await db.update(transactionsTable).set({ receiptPrinted: true }).where(eq(transactionsTable.id, t.id));

  res.json({
    transactionId: t.id,
    storeName: "PharmaPOS Chemist",
    storeAddress: "Nairobi, Kenya",
    storePhone: "+254 700 000 000",
    cashierName: "Cashier",
    customerName: t.customerName,
    items: (t.items as StoredItem[]) || [],
    subtotal: Number(t.totalAmount) + Number(t.discountAmount),
    discountAmount: Number(t.discountAmount),
    taxAmount: Number(t.taxAmount),
    totalAmount: Number(t.totalAmount),
    paidAmount: Number(t.paidAmount),
    changeAmount: Number(t.changeAmount),
    paymentMethod: t.paymentMethod,
    referenceCode: t.referenceCode,
    createdAt: t.createdAt.toISOString(),
  });
});

export default router;
