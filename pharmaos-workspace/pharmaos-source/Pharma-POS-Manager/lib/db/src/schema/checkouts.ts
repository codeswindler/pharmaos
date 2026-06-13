import { mysqlTable, int, decimal, timestamp, varchar } from "drizzle-orm/mysql-core";
import { pharmaciesTable } from "./pharmacies";
import { usersTable } from "./users";
import { customersTable } from "./customers";
import { productsTable } from "./products";

export const checkoutsTable = mysqlTable("checkouts", {
  id: int("id").autoincrement().primaryKey(),
  legacyTransactionId: int("legacy_transaction_id").unique(),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  customerId: int("customer_id").references(() => customersTable.id),
  customerName: varchar("customer_name", { length: 255 }),
  cashierId: int("cashier_id").notNull().references(() => usersTable.id),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  balanceAmount: decimal("balance_amount", { precision: 12, scale: 2 }).notNull(),
  changeAmount: decimal("change_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 64 }).notNull().default("open"),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  completedAt: timestamp("completed_at", { mode: "date" }),
  cancelledAt: timestamp("cancelled_at", { mode: "date" }),
  voidedAt: timestamp("voided_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const checkoutItemsTable = mysqlTable("checkout_items", {
  id: int("id").autoincrement().primaryKey(),
  checkoutId: int("checkout_id").notNull().references(() => checkoutsTable.id),
  productId: int("product_id").notNull().references(() => productsTable.id),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 128 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
});

export const paymentsTable = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  checkoutId: int("checkout_id").references(() => checkoutsTable.id),
  method: varchar("method", { length: 32 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  appliedAmount: decimal("applied_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  changeAmount: decimal("change_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 64 }).notNull().default("unmatched"),
  source: varchar("source", { length: 64 }).notNull().default("manual"),
  referenceCode: varchar("reference_code", { length: 128 }).unique(),
  checkoutRequestId: varchar("checkout_request_id", { length: 128 }).unique(),
  payerName: varchar("payer_name", { length: 255 }),
  payerPhone: varchar("payer_phone", { length: 32 }),
  rawPayload: varchar("raw_payload", { length: 4096 }),
  receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
  attachedAt: timestamp("attached_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});
