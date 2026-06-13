import { mysqlTable, int, decimal, boolean, timestamp, varchar, json } from "drizzle-orm/mysql-core";
import { pharmaciesTable } from "./pharmacies";

// Read-only archive mapping retained so legacy sales survive schema synchronization.
export const legacyTransactionsTable = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").references(() => pharmaciesTable.id),
  customerId: int("customer_id"),
  customerName: varchar("customer_name", { length: 255 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull(),
  changeAmount: decimal("change_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 64 }).notNull().default("completed"),
  paymentMethod: varchar("payment_method", { length: 64 }).notNull().default("cash"),
  referenceCode: varchar("reference_code", { length: 128 }),
  validationCode: varchar("validation_code", { length: 128 }),
  isValidated: boolean("is_validated").notNull().default(false),
  receiptPrinted: boolean("receipt_printed").notNull().default(false),
  items: json("items").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});
