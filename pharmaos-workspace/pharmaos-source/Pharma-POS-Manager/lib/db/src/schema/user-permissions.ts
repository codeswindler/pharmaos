import { mysqlTable, int, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const userPermissionsTable = mysqlTable("user_permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id),
  moduleKey: varchar("module_key", { length: 64 }).notNull(),
  enabled: int("enabled").notNull().default(1),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, table => ({
  userModuleUnique: uniqueIndex("user_permissions_user_module_unique").on(table.userId, table.moduleKey),
}));
