import { Router } from "express";
import { db, messagesTable, customersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  SendMessageBody,
  GetMessageParams,
} from "@workspace/api-zod";

const router = Router();

function formatMessage(m: typeof messagesTable.$inferSelect) {
  return {
    id: m.id,
    title: m.title,
    content: m.content,
    recipientType: m.recipientType,
    recipientCount: m.recipientCount,
    status: m.status,
    scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
    sentAt: m.sentAt ? m.sentAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const rows = await db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt));
  res.json(rows.map(formatMessage));
});

router.post("/", async (req, res) => {
  const body = SendMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }

  // Count recipients
  const allCustomers = await db.select().from(customersTable);
  let recipientCount = allCustomers.length;

  if (body.data.recipientType === "loyalty") {
    recipientCount = allCustomers.filter((c) => c.loyaltyPoints > 0).length;
  } else if (body.data.recipientType === "inactive") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    recipientCount = allCustomers.filter(
      (c) => !c.lastVisit || c.lastVisit < thirtyDaysAgo
    ).length;
  } else if (body.data.recipientType === "custom" && body.data.recipientIds) {
    recipientCount = body.data.recipientIds.length;
  }

  const isScheduled = !!body.data.scheduledAt;
  const [message] = await db.insert(messagesTable).values({
    title: body.data.title,
    content: body.data.content,
    recipientType: body.data.recipientType,
    recipientCount,
    status: isScheduled ? "scheduled" : "sent",
    scheduledAt: body.data.scheduledAt ? new Date(body.data.scheduledAt) : null,
    sentAt: isScheduled ? null : new Date(),
  }).returning();

  res.status(201).json(formatMessage(message));
});

router.get("/:id", async (req, res) => {
  const params = GetMessageParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, params.data.id));
  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  res.json(formatMessage(message));
});

export default router;
