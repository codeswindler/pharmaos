import { mysqlTable, text, int, decimal, timestamp, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pharmaciesTable } from "./pharmacies";
import { usersTable } from "./users";
import { paymentsTable } from "./checkouts";

export const messagesTable = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  createdBy: int("created_by").references(() => usersTable.id),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  recipientType: varchar("recipient_type", { length: 64 }).notNull().default("all"),
  dateFrom: timestamp("date_from", { mode: "date" }),
  dateTo: timestamp("date_to", { mode: "date" }),
  recipientCount: int("recipient_count").notNull().default(0),
  characterCount: int("character_count").notNull().default(0),
  segmentCount: int("segment_count").notNull().default(0),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  actualCost: decimal("actual_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  sentCount: int("sent_count").notNull().default(0),
  deliveredCount: int("delivered_count").notNull().default(0),
  failedCount: int("failed_count").notNull().default(0),
  status: varchar("status", { length: 64 }).notNull().default("queued"),
  scheduledAt: timestamp("scheduled_at", { mode: "date" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const messageRecipientsTable = mysqlTable("message_recipients", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("message_id").notNull().references(() => messagesTable.id),
  pharmacyId: int("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  paymentId: int("payment_id").references(() => paymentsTable.id),
  recipientName: varchar("recipient_name", { length: 255 }),
  phone: varchar("phone", { length: 128 }).notNull(),
  isHashed: int("is_hashed").notNull().default(0),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  providerNetworkId: varchar("provider_network_id", { length: 64 }),
  responseCode: varchar("response_code", { length: 64 }),
  responseDescription: varchar("response_description", { length: 512 }),
  status: varchar("status", { length: 64 }).notNull().default("queued"),
  cost: decimal("cost", { precision: 12, scale: 2 }).notNull().default("0"),
  rawResponse: text("raw_response"),
  statusCheckedAt: timestamp("status_checked_at", { mode: "date" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  deliveredAt: timestamp("delivered_at", { mode: "date" }),
  failedAt: timestamp("failed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
