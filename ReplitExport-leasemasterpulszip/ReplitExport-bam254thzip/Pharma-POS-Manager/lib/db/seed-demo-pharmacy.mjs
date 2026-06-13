import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL ?? process.env.MYSQL_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or MYSQL_URL must be set");

const db = await mysql.createConnection(databaseUrl);
const pharmacyName = process.env.DEMO_PHARMACY_NAME ?? "Nairobi Demo Pharmacy";
const [[pharmacy]] = await db.query("SELECT id FROM pharmacies WHERE name = ? LIMIT 1", [pharmacyName]);
if (!pharmacy) throw new Error(`Pharmacy not found: ${pharmacyName}`);

const [[cashier]] = await db.query(
  "SELECT id FROM users WHERE pharmacy_id = ? AND role = 'cashier' AND is_active = true ORDER BY id LIMIT 1",
  [pharmacy.id],
);
if (!cashier) throw new Error(`Active cashier not found for ${pharmacyName}`);

const products = [
  ["Paracetamol 500mg Tablets", "NBO-PARA-500", "6161100010011", "Pain & Fever", 100, 55, 86, 20, "pack", "Dawa Limited", "2027-10-31", false],
  ["Panadol Extra Tablets", "NBO-PAN-EXT", "6161100010028", "Pain & Fever", 180, 118, 42, 12, "pack", "Haleon", "2027-08-31", false],
  ["Brufen 400mg Tablets", "NBO-BRF-400", "6161100010035", "Pain & Fever", 220, 145, 8, 10, "pack", "Abbott", "2027-04-30", false],
  ["Cetirizine 10mg Tablets", "NBO-CET-010", "6161100010042", "Allergy", 120, 65, 64, 15, "pack", "Cosmos", "2027-12-31", false],
  ["Piriton Tablets", "NBO-PIR-TAB", "6161100010059", "Allergy", 160, 98, 23, 10, "pack", "GSK", "2027-09-30", false],
  ["Amoxicillin 500mg Capsules", "NBO-AMX-500", "6161100010066", "Prescription", 450, 290, 31, 10, "pack", "Dawa Limited", "2027-06-30", true],
  ["Azithromycin 500mg Tablets", "NBO-AZI-500", "6161100010073", "Prescription", 620, 410, 14, 8, "pack", "Universal Corporation", "2027-05-31", true],
  ["Metformin 500mg Tablets", "NBO-MET-500", "6161100010080", "Chronic Care", 350, 225, 55, 15, "pack", "Cosmos", "2028-01-31", true],
  ["Amlodipine 5mg Tablets", "NBO-AML-005", "6161100010097", "Chronic Care", 280, 175, 38, 12, "pack", "Regal Pharmaceuticals", "2027-11-30", true],
  ["Omeprazole 20mg Capsules", "NBO-OME-020", "6161100010103", "Digestive Health", 250, 145, 47, 12, "pack", "Laboratory & Allied", "2027-07-31", false],
  ["Gaviscon Liquid 150ml", "NBO-GAV-150", "6161100010110", "Digestive Health", 480, 320, 11, 10, "bottle", "Reckitt", "2027-03-31", false],
  ["ORS Sachets", "NBO-ORS-S01", "6161100010127", "Digestive Health", 50, 24, 95, 25, "sachet", "KAPI", "2028-03-31", false],
  ["Vitamin C 1000mg", "NBO-VTC-1K", "6161100010134", "Vitamins", 420, 275, 34, 10, "tube", "HealthAid", "2027-08-31", false],
  ["Zinc 20mg Tablets", "NBO-ZNC-020", "6161100010141", "Vitamins", 300, 190, 18, 8, "pack", "Dawa Limited", "2027-10-31", false],
  ["Seven Seas Cod Liver Oil", "NBO-CLO-100", "6161100010158", "Vitamins", 780, 545, 9, 10, "bottle", "Seven Seas", "2027-04-30", false],
  ["Benylin Dry Cough 100ml", "NBO-BEN-DRY", "6161100010165", "Cough & Cold", 520, 345, 16, 8, "bottle", "Johnson & Johnson", "2027-02-28", false],
  ["Vicks Vaporub 50g", "NBO-VCK-050", "6161100010172", "Cough & Cold", 390, 255, 27, 10, "jar", "P&G", "2027-09-30", false],
  ["Savlon Antiseptic 125ml", "NBO-SAV-125", "6161100010189", "First Aid", 280, 165, 4, 8, "bottle", "GSK", "2027-06-30", false],
  ["Elastoplast Plasters 20s", "NBO-ELA-020", "6161100010196", "First Aid", 350, 220, 0, 8, "box", "Beiersdorf", "2028-01-31", false],
  ["Digital Thermometer", "NBO-THM-DIG", "6161100010202", "Medical Devices", 650, 390, 12, 5, "unit", "Rossmax", null, false],
  ["Blood Glucose Test Strips", "NBO-GLU-050", "6161100010219", "Medical Devices", 1650, 1180, 7, 6, "box", "Accu-Chek", "2027-12-31", false],
  ["Hand Sanitizer 500ml", "NBO-SAN-500", "6161100010226", "Personal Care", 380, 225, 29, 10, "bottle", "Haco Industries", "2027-11-30", false],
];

const customers = [
  ["Mary Wanjiku", "254712345601", "mary.wanjiku@example.test"],
  ["Peter Kamau", "254712345602", "peter.kamau@example.test"],
  ["Jane Njeri", "254712345603", "jane.njeri@example.test"],
  ["David Otieno", "254712345604", "david.otieno@example.test"],
  ["Grace Achieng", "254712345605", "grace.achieng@example.test"],
  ["John Mwangi", "254712345606", "john.mwangi@example.test"],
  ["Faith Muthoni", "254712345607", "faith.muthoni@example.test"],
  ["Samuel Kiptoo", "254712345608", "samuel.kiptoo@example.test"],
  ["Lucy Atieno", "254712345609", "lucy.atieno@example.test"],
  ["Brian Maina", "254712345610", "brian.maina@example.test"],
  ["Esther Nyambura", "254712345611", "esther.nyambura@example.test"],
  ["Ahmed Hassan", "254712345612", "ahmed.hassan@example.test"],
];

const salePlans = [
  { days: 13, hour: 10, customer: 0, items: [["NBO-PARA-500", 2], ["NBO-VTC-1K", 1]], method: "mpesa" },
  { days: 12, hour: 16, customer: 1, items: [["NBO-AMX-500", 1], ["NBO-PAN-EXT", 1]], method: "cash" },
  { days: 11, hour: 9, customer: 2, items: [["NBO-CET-010", 2], ["NBO-PIR-TAB", 1]], method: "mpesa" },
  { days: 10, hour: 14, customer: 3, items: [["NBO-MET-500", 2], ["NBO-AML-005", 1]], method: "mpesa" },
  { days: 9, hour: 11, customer: 4, items: [["NBO-ORS-S01", 4], ["NBO-ZNC-020", 1]], method: "cash" },
  { days: 8, hour: 17, customer: 5, items: [["NBO-BEN-DRY", 1], ["NBO-VCK-050", 1]], method: "split" },
  { days: 7, hour: 10, customer: 6, items: [["NBO-OME-020", 2], ["NBO-GAV-150", 1]], method: "mpesa" },
  { days: 6, hour: 9, customer: 7, items: [["NBO-PARA-500", 3], ["NBO-SAN-500", 1]], method: "cash" },
  { days: 5, hour: 15, customer: 8, items: [["NBO-PAN-EXT", 2], ["NBO-VTC-1K", 1]], method: "mpesa" },
  { days: 4, hour: 12, customer: 9, items: [["NBO-AZI-500", 1], ["NBO-ORS-S01", 2]], method: "mpesa" },
  { days: 3, hour: 10, customer: 10, items: [["NBO-SAV-125", 1], ["NBO-ELA-020", 1]], method: "cash" },
  { days: 2, hour: 17, customer: 11, items: [["NBO-THM-DIG", 1], ["NBO-PARA-500", 1]], method: "split" },
  { days: 1, hour: 9, customer: 0, items: [["NBO-MET-500", 1], ["NBO-AML-005", 1], ["NBO-VTC-1K", 1]], method: "mpesa" },
  { days: 1, hour: 16, customer: 3, items: [["NBO-GLU-050", 1], ["NBO-SAN-500", 1]], method: "cash" },
  { days: 0, hour: 8, customer: 2, items: [["NBO-PARA-500", 2], ["NBO-ORS-S01", 3]], method: "cash" },
  { days: 0, hour: 10, customer: 5, items: [["NBO-BEN-DRY", 1], ["NBO-VCK-050", 1], ["NBO-VTC-1K", 1]], method: "mpesa" },
  { days: 0, hour: 12, customer: 7, items: [["NBO-OME-020", 1], ["NBO-GAV-150", 1]], method: "split" },
  { days: 0, hour: 14, customer: 10, items: [["NBO-SAV-125", 1], ["NBO-PAN-EXT", 1]], method: "mpesa" },
];

const atDaysAgo = (days, hour, minute = 15) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(hour, minute, 0, 0);
  return value;
};

await db.beginTransaction();
try {
  if ((await db.query("SHOW TABLES LIKE 'message_recipients'"))[0].length) {
    await db.query("DELETE FROM message_recipients WHERE pharmacy_id = ?", [pharmacy.id]);
  }
  if ((await db.query("SHOW TABLES LIKE 'sms_wallet_transactions'"))[0].length) {
    await db.query("DELETE FROM sms_wallet_transactions WHERE pharmacy_id = ?", [pharmacy.id]);
  }
  await db.query("DELETE FROM payments WHERE pharmacy_id = ?", [pharmacy.id]);
  await db.query("DELETE ci FROM checkout_items ci JOIN checkouts c ON c.id = ci.checkout_id WHERE c.pharmacy_id = ?", [pharmacy.id]);
  await db.query("DELETE FROM checkouts WHERE pharmacy_id = ?", [pharmacy.id]);
  await db.query("DELETE FROM messages WHERE pharmacy_id = ?", [pharmacy.id]);
  await db.query("DELETE FROM customers WHERE pharmacy_id = ?", [pharmacy.id]);
  await db.query("DELETE FROM products WHERE pharmacy_id = ?", [pharmacy.id]);

  const productIds = new Map();
  for (const product of products) {
    const [result] = await db.query(`
      INSERT INTO products (
        pharmacy_id, name, sku, barcode, description, category, price, cost_price,
        stock_qty, reserved_qty, low_stock_threshold, unit, manufacturer, expiry_date,
        requires_prescription, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, true)
    `, [
      pharmacy.id, product[0], product[1], product[2],
      `${product[0]} supplied for the Nairobi retail pharmacy demo.`,
      product[3], product[4], product[5], product[6], product[7], product[8], product[9], product[10], product[11],
    ]);
    productIds.set(product[1], result.insertId);
  }

  const customerRows = [];
  for (const customer of customers) {
    const [result] = await db.query(
      "INSERT INTO customers (pharmacy_id, name, phone, email) VALUES (?, ?, ?, ?)",
      [pharmacy.id, ...customer],
    );
    customerRows.push({ id: result.insertId, name: customer[0] });
  }

  const customerStats = new Map(customerRows.map(row => [row.id, { spend: 0, visits: 0, lastVisit: null }]));
  let mpesaSequence = 1000;
  for (const plan of salePlans) {
    const createdAt = atDaysAgo(plan.days, plan.hour, (plan.customer * 7) % 50);
    const lineItems = plan.items.map(([sku, quantity]) => {
      const product = products.find(row => row[1] === sku);
      return { id: productIds.get(sku), name: product[0], sku, quantity, price: Number(product[4]) };
    });
    const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = subtotal >= 1500 ? 100 : 0;
    const total = subtotal - discount;
    const customer = customerRows[plan.customer];
    const [checkoutResult] = await db.query(`
      INSERT INTO checkouts (
        pharmacy_id, customer_id, customer_name, cashier_id, subtotal, discount_amount,
        total_amount, paid_amount, balance_amount, change_amount, status, expires_at,
        completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'completed', ?, ?, ?, ?)
    `, [
      pharmacy.id, customer.id, customer.name, cashier.id, subtotal, discount, total, total,
      new Date(createdAt.getTime() + 15 * 60 * 1000), createdAt, createdAt, createdAt,
    ]);

    for (const item of lineItems) {
      await db.query(`
        INSERT INTO checkout_items (checkout_id, product_id, product_name, sku, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [checkoutResult.insertId, item.id, item.name, item.sku, item.quantity, item.price, item.price * item.quantity]);
    }

    if (plan.method === "split") {
      const cash = Math.floor(total * 0.4 / 50) * 50;
      await db.query(`
        INSERT INTO payments (pharmacy_id, checkout_id, method, amount, applied_amount, status, source, received_at, attached_at, created_at, updated_at)
        VALUES (?, ?, 'cash', ?, ?, 'attached', 'manual', ?, ?, ?, ?)
      `, [pharmacy.id, checkoutResult.insertId, cash, cash, createdAt, createdAt, createdAt, createdAt]);
      await db.query(`
        INSERT INTO payments (
          pharmacy_id, checkout_id, method, amount, applied_amount, status, source,
          reference_code, payer_name, payer_phone, received_at, attached_at, created_at, updated_at
        ) VALUES (?, ?, 'mpesa', ?, ?, 'attached', 'c2b', ?, ?, ?, ?, ?, ?, ?)
      `, [
        pharmacy.id, checkoutResult.insertId, total - cash, total - cash, `NBO${mpesaSequence++}`,
        customer.name, customers[plan.customer][1], createdAt, createdAt, createdAt, createdAt,
      ]);
    } else {
      const isMpesa = plan.method === "mpesa";
      await db.query(`
        INSERT INTO payments (
          pharmacy_id, checkout_id, method, amount, applied_amount, status, source,
          reference_code, payer_name, payer_phone, received_at, attached_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'attached', ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        pharmacy.id, checkoutResult.insertId, isMpesa ? "mpesa" : "cash", total, total,
        isMpesa ? "c2b" : "manual", isMpesa ? `NBO${mpesaSequence++}` : null,
        isMpesa ? customer.name : null, isMpesa ? customers[plan.customer][1] : null,
        createdAt, createdAt, createdAt, createdAt,
      ]);
    }

    const stats = customerStats.get(customer.id);
    stats.spend += total;
    stats.visits += 1;
    if (!stats.lastVisit || createdAt > stats.lastVisit) stats.lastVisit = createdAt;
  }

  for (const [customerId, stats] of customerStats) {
    await db.query(
      "UPDATE customers SET total_spend = ?, visit_count = ?, loyalty_points = ?, last_visit = ? WHERE id = ?",
      [stats.spend, stats.visits, Math.floor(stats.spend / 100), stats.lastVisit, customerId],
    );
  }

  const openCreated = new Date(Date.now() - 30 * 60 * 1000);
  const [openCheckout] = await db.query(`
    INSERT INTO checkouts (
      pharmacy_id, customer_id, customer_name, cashier_id, subtotal, discount_amount,
      total_amount, paid_amount, balance_amount, change_amount, status, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 570, 0, 570, 200, 370, 0, 'open', ?, ?, ?)
  `, [pharmacy.id, customerRows[4].id, customerRows[4].name, cashier.id, new Date(Date.now() + 60 * 60 * 1000), openCreated, openCreated]);
  for (const [sku, quantity] of [["NBO-AMX-500", 1], ["NBO-CET-010", 1]]) {
    const product = products.find(row => row[1] === sku);
    await db.query(`
      INSERT INTO checkout_items (checkout_id, product_id, product_name, sku, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [openCheckout.insertId, productIds.get(sku), product[0], sku, quantity, product[4], product[4] * quantity]);
  }
  await db.query(`
    INSERT INTO payments (pharmacy_id, checkout_id, method, amount, applied_amount, status, source, received_at, attached_at)
    VALUES (?, ?, 'cash', 200, 200, 'attached', 'manual', ?, ?)
  `, [pharmacy.id, openCheckout.insertId, openCreated, openCreated]);
  await db.query("UPDATE products SET reserved_qty = 1 WHERE id IN (?, ?)", [productIds.get("NBO-AMX-500"), productIds.get("NBO-CET-010")]);

  await db.query(`
    INSERT INTO payments (
      pharmacy_id, method, amount, applied_amount, status, source, reference_code,
      payer_name, payer_phone, received_at, created_at, updated_at
    ) VALUES (?, 'mpesa', 370, 0, 'unmatched', 'c2b', 'NBODEMO370', 'Grace Achieng', '254712345605', ?, ?, ?)
  `, [pharmacy.id, new Date(), new Date(), new Date()]);

  const messages = [
    ["June wellness offer", "Get 10% off selected vitamins and first-aid products this week.", "all", atDaysAgo(2, 11)],
    ["Refill reminder", "Your regular prescription refill may be due. Visit Nairobi Demo Pharmacy or call us for assistance.", "this_week", atDaysAgo(5, 9)],
    ["Customer appreciation message", "Thank you for trusting Nairobi Demo Pharmacy with your health needs.", "all", atDaysAgo(7, 10)],
  ];
  const [mpesaContacts] = await db.query(`
    SELECT p.id, p.payer_name, p.payer_phone
    FROM payments p
    JOIN checkouts c ON c.id = p.checkout_id
    WHERE p.pharmacy_id = ? AND p.method = 'mpesa' AND p.status = 'attached' AND c.status = 'completed'
    GROUP BY p.payer_phone, p.id, p.payer_name
    ORDER BY p.id DESC
  `, [pharmacy.id]);
  const contactsByPhone = [...new Map(mpesaContacts.filter(row => row.payer_phone).map(row => [row.payer_phone, row])).values()];
  for (const message of messages) {
    const [title, content, recipientType, sentAt] = message;
    const characterCount = content.length;
    const segmentCount = characterCount <= 160 ? 1 : Math.ceil(characterCount / 153);
    const cost = contactsByPhone.length * segmentCount;
    const [messageResult] = await db.query(`
      INSERT INTO messages (
        pharmacy_id, title, content, recipient_type, recipient_count, character_count, segment_count,
        estimated_cost, actual_cost, sent_count, delivered_count, failed_count, status, sent_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'partially_failed', ?, ?, ?)
    `, [pharmacy.id, title, content, recipientType, contactsByPhone.length, characterCount, segmentCount, cost, cost - 1, contactsByPhone.length - 1, contactsByPhone.length - 2, 1, sentAt, sentAt, sentAt]);
    for (const [index, contact] of contactsByPhone.entries()) {
      const status = index === 0 ? "failed" : index === 1 ? "sent" : "delivered";
      await db.query(`
        INSERT INTO message_recipients (
          message_id, pharmacy_id, payment_id, recipient_name, phone, provider_message_id, provider_network_id,
          response_code, response_description, status, cost, sent_at, delivered_at, failed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, '1', ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `, [
        messageResult.insertId, pharmacy.id, contact.id, contact.payer_name, contact.payer_phone, `SMS-DEMO-${messageResult.insertId}-${index + 1}`,
        status === "failed" ? "1006" : "200", status === "failed" ? "Demo delivery failed" : status === "sent" ? "Accepted by provider" : "Delivered",
        status, sentAt, status === "delivered" ? sentAt : null, status === "failed" ? sentAt : null, sentAt, sentAt,
      ]);
    }
  }

  await db.query(`
    INSERT INTO sms_wallets (pharmacy_id, balance)
    VALUES (?, 500)
    ON DUPLICATE KEY UPDATE balance = VALUES(balance)
  `, [pharmacy.id]);
  await db.query(`
    INSERT INTO sms_configs (pharmacy_id, unit_rate, callback_token, enabled)
    VALUES (?, 1, ?, 0)
    ON DUPLICATE KEY UPDATE unit_rate = VALUES(unit_rate)
  `, [pharmacy.id, `demo-sms-${pharmacy.id}`]);

  await db.commit();
  console.log(`Demo data ready for ${pharmacyName}: ${products.length} products, ${salePlans.length} completed sales, ${contactsByPhone.length} SMS sales contacts`);
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
