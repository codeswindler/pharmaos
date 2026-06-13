import { mysqlTable, text, int, decimal, boolean, timestamp, date, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pharmaciesTable } from "./pharmacies";

export const productsTable = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").references(() => pharmaciesTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 128 }).notNull().unique(),
  barcode: varchar("barcode", { length: 128 }),
  description: text("description"),
  category: varchar("category", { length: 128 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  stockQty: int("stock_qty").notNull().default(0),
  reservedQty: int("reserved_qty").notNull().default(0),
  lowStockThreshold: int("low_stock_threshold").notNull().default(10),
  unit: varchar("unit", { length: 32 }).notNull().default("pcs"),
  manufacturer: varchar("manufacturer", { length: 255 }),
  expiryDate: date("expiry_date", { mode: "string" }),
  requiresPrescription: boolean("requires_prescription").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
