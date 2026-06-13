import { mysqlTable, int, decimal, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { pharmaciesTable } from "./pharmacies";
import { usersTable } from "./users";

export const smsConfigsTable = mysqlTable("sms_configs", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  baseUrl: varchar("base_url", { length: 512 }).notNull().default(""),
  apiKeyEncrypted: text("api_key_encrypted"),
  partnerIdEncrypted: text("partner_id_encrypted"),
  shortcode: varchar("shortcode", { length: 128 }).notNull().default(""),
  sendEndpointPath: varchar("send_endpoint_path", { length: 255 }).notNull().default("/api/services/sendsms"),
  hashedEndpointPath: varchar("hashed_endpoint_path", { length: 255 }).notNull().default("/api/services/sendotp"),
  statusEndpointPath: varchar("status_endpoint_path", { length: 255 }).notNull().default("/api/services/getdlr"),
  unitRate: decimal("unit_rate", { precision: 10, scale: 4 }).notNull().default("1"),
  enabled: int("enabled").notNull().default(0),
  callbackToken: varchar("callback_token", { length: 128 }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, table => ({
  pharmacyUnique: uniqueIndex("sms_configs_pharmacy_unique").on(table.pharmacyId),
  callbackUnique: uniqueIndex("sms_configs_callback_unique").on(table.callbackToken),
}));

export const smsWalletsTable = mysqlTable("sms_wallets", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, table => ({
  pharmacyUnique: uniqueIndex("sms_wallets_pharmacy_unique").on(table.pharmacyId),
}));

export const smsWalletTransactionsTable = mysqlTable("sms_wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  createdBy: int("created_by").references(() => usersTable.id),
  type: varchar("type", { length: 32 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }).notNull(),
  reference: varchar("reference", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
