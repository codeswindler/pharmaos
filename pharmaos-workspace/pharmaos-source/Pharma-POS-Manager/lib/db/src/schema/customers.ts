import { mysqlTable, int, decimal, timestamp, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pharmaciesTable } from "./pharmacies";

export const customersTable = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").references(() => pharmaciesTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 255 }),
  loyaltyPoints: int("loyalty_points").notNull().default(0),
  totalSpend: decimal("total_spend", { precision: 12, scale: 2 }).notNull().default("0"),
  visitCount: int("visit_count").notNull().default(0),
  lastVisit: timestamp("last_visit", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true, loyaltyPoints: true, totalSpend: true, visitCount: true, lastVisit: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
