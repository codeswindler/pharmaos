import { mysqlTable, int, decimal, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { pharmaciesTable } from "./pharmacies";
import { usersTable } from "./users";
import { messagesTable } from "./messages";

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

export const platformSmsSettingsTable = mysqlTable("platform_sms_settings", {
  id: int("id").primaryKey().default(1),
  baseUrl: varchar("base_url", { length: 512 }).notNull().default(""),
  apiKeyEncrypted: text("api_key_encrypted"),
  partnerIdEncrypted: text("partner_id_encrypted"),
  shortcode: varchar("shortcode", { length: 128 }).notNull().default(""),
  sendEndpointPath: varchar("send_endpoint_path", { length: 255 }).notNull().default("/api/services/sendsms"),
  hashedEndpointPath: varchar("hashed_endpoint_path", { length: 255 }).notNull().default("/api/services/sendotp"),
  statusEndpointPath: varchar("status_endpoint_path", { length: 255 }).notNull().default("/api/services/getdlr"),
  unitRate: decimal("unit_rate", { precision: 10, scale: 4 }).notNull().default("1"),
  smsEnabled: int("sms_enabled").notNull().default(0),
  smsCallbackToken: varchar("sms_callback_token", { length: 128 }).notNull().unique(),
  mpesaEnvironment: varchar("mpesa_environment", { length: 32 }).notNull().default("sandbox"),
  mpesaShortcode: varchar("mpesa_shortcode", { length: 32 }).notNull().default(""),
  mpesaTransactionType: varchar("mpesa_transaction_type", { length: 64 }).notNull().default("CustomerPayBillOnline"),
  mpesaConsumerKeyEncrypted: text("mpesa_consumer_key_encrypted"),
  mpesaConsumerSecretEncrypted: text("mpesa_consumer_secret_encrypted"),
  mpesaPasskeyEncrypted: text("mpesa_passkey_encrypted"),
  mpesaCallbackToken: varchar("mpesa_callback_token", { length: 128 }).notNull().unique(),
  mpesaEnabled: int("mpesa_enabled").notNull().default(0),
  smsVerifiedAt: timestamp("sms_verified_at", { mode: "date" }),
  mpesaVerifiedAt: timestamp("mpesa_verified_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const smsPurchasesTable = mysqlTable("sms_purchases", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  messageId: int("message_id").notNull().references(() => messagesTable.id),
  createdBy: int("created_by").notNull().references(() => usersTable.id),
  quotedAmount: decimal("quoted_amount", { precision: 12, scale: 2 }).notNull(),
  creditApplied: decimal("credit_applied", { precision: 12, scale: 2 }).notNull().default("0"),
  amountDue: decimal("amount_due", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  refundCredit: decimal("refund_credit", { precision: 12, scale: 2 }).notNull().default("0"),
  phone: varchar("phone", { length: 32 }),
  status: varchar("status", { length: 64 }).notNull().default("awaiting_payment"),
  checkoutRequestId: varchar("checkout_request_id", { length: 128 }).unique(),
  referenceCode: varchar("reference_code", { length: 128 }).unique(),
  failureReason: varchar("failure_reason", { length: 512 }),
  rawPayload: text("raw_payload"),
  paidAt: timestamp("paid_at", { mode: "date" }),
  processingStartedAt: timestamp("processing_started_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => ({
  messageUnique: uniqueIndex("sms_purchases_message_unique").on(table.messageId),
}));

export const credentialRevealAuditsTable = mysqlTable("credential_reveal_audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id),
  scope: varchar("scope", { length: 64 }).notNull(),
  targetId: int("target_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
