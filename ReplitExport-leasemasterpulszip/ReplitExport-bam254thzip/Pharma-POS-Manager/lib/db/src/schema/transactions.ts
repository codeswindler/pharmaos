import { pgTable, text, serial, integer, numeric, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  customerName: text("customer_name"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull(),
  changeAmount: numeric("change_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("completed"),
  paymentMethod: text("payment_method").notNull().default("cash"),
  referenceCode: text("reference_code"),
  validationCode: text("validation_code"),
  isValidated: boolean("is_validated").notNull().default(false),
  receiptPrinted: boolean("receipt_printed").notNull().default(false),
  items: jsonb("items").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
