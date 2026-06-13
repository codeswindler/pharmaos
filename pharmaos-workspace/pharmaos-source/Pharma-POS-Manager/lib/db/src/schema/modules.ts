import { mysqlTable, int, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { pharmaciesTable } from "./pharmacies";

export const pharmacyModulesTable = mysqlTable("pharmacy_modules", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  moduleKey: varchar("module_key", { length: 64 }).notNull(),
  enabled: int("enabled").notNull().default(1),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, table => ({
  pharmacyModuleUnique: uniqueIndex("pharmacy_modules_pharmacy_module_unique").on(table.pharmacyId, table.moduleKey),
}));
