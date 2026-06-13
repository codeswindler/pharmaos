import { mysqlTable, int, boolean, timestamp, varchar } from "drizzle-orm/mysql-core";
import { pharmaciesTable } from "./pharmacies";

export const mpesaConfigsTable = mysqlTable("mpesa_configs", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").notNull().unique().references(() => pharmaciesTable.id),
  environment: varchar("environment", { length: 32 }).notNull().default("sandbox"),
  shortcode: varchar("shortcode", { length: 32 }).notNull(),
  transactionType: varchar("transaction_type", { length: 64 }).notNull().default("CustomerPayBillOnline"),
  consumerKeyEncrypted: varchar("consumer_key_encrypted", { length: 1024 }).notNull(),
  consumerSecretEncrypted: varchar("consumer_secret_encrypted", { length: 1024 }).notNull(),
  passkeyEncrypted: varchar("passkey_encrypted", { length: 1024 }),
  callbackToken: varchar("callback_token", { length: 128 }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  credentialsVerifiedAt: timestamp("credentials_verified_at", { mode: "date" }),
  callbacksRegisteredAt: timestamp("callbacks_registered_at", { mode: "date" }),
  registrationStatus: varchar("registration_status", { length: 32 }).notNull().default("not_registered"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});
