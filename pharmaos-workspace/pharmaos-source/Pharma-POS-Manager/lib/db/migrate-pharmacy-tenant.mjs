import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL ?? process.env.MYSQL_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or MYSQL_URL must be set");

const db = await mysql.createConnection(databaseUrl);

const tableExists = async (name) => {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [name],
  );
  return Number(rows[0].count) > 0;
};

const columnExists = async (table, column) => {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column],
  );
  return Number(rows[0].count) > 0;
};

if (await tableExists("hospitals")) {
  if (!(await tableExists("pharmacies"))) {
    await db.query("RENAME TABLE hospitals TO pharmacies");
  } else {
    await db.query(`
      INSERT IGNORE INTO pharmacies (id, name, address, phone, email, plan_type, plan_value, status, created_at, updated_at)
      SELECT id, name, address, phone, email, plan_type, plan_value, status, created_at, updated_at
      FROM hospitals
    `);
    await db.query("DROP TABLE hospitals");
  }
}

if (await tableExists("pharmacies") && await columnExists("pharmacies", "license_number")) {
  await db.query("ALTER TABLE pharmacies DROP COLUMN license_number");
}

if (await tableExists("users")) {
  if (await columnExists("users", "hospital_id")) {
    await db.query("ALTER TABLE users CHANGE hospital_id pharmacy_id INT NULL");
  }
  if (!(await columnExists("users", "phone"))) {
    await db.query("ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL AFTER email");
  }
  await db.query(`
    UPDATE users
    SET phone = CONCAT('254700', LPAD(id, 6, '0'))
    WHERE phone IS NULL OR phone = ''
  `);
  await db.query("ALTER TABLE users MODIFY phone VARCHAR(32) NOT NULL");
  try {
    await db.query("ALTER TABLE users ADD UNIQUE KEY users_phone_unique (phone)");
  } catch (error) {
    if (error?.code !== "ER_DUP_KEYNAME") throw error;
  }
  await db.query("UPDATE users SET role = 'super_admin' WHERE role = 'admin'");
  await db.query("UPDATE users SET role = 'pharmacy_owner' WHERE role = 'client'");

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      module_key VARCHAR(64) NOT NULL,
      enabled INT NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY user_permissions_user_module_unique (user_id, module_key),
      CONSTRAINT user_permissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

let firstPharmacyId = null;
if (await tableExists("pharmacies")) {
  const [pharmacies] = await db.query("SELECT id FROM pharmacies ORDER BY created_at, id LIMIT 1");
  firstPharmacyId = pharmacies[0]?.id ?? null;
}

for (const table of ["products", "customers", "messages", "transactions"]) {
  if (!(await tableExists(table))) continue;
  if (!(await columnExists(table, "pharmacy_id"))) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN pharmacy_id INT NULL AFTER id`);
  }
  if (firstPharmacyId !== null) {
    await db.query(`UPDATE \`${table}\` SET pharmacy_id = ? WHERE pharmacy_id IS NULL`, [firstPharmacyId]);
  }
}

if (await tableExists("products") && !(await columnExists("products", "reserved_qty"))) {
  await db.query("ALTER TABLE products ADD COLUMN reserved_qty INT NOT NULL DEFAULT 0 AFTER stock_qty");
}

if (
  await tableExists("transactions") &&
  await tableExists("checkouts") &&
  await tableExists("checkout_items") &&
  await tableExists("payments") &&
  await columnExists("checkouts", "legacy_transaction_id")
) {
  const [legacyRows] = await db.query("SELECT * FROM transactions ORDER BY id");
  for (const legacy of legacyRows) {
    const [existing] = await db.query("SELECT id FROM checkouts WHERE legacy_transaction_id = ? LIMIT 1", [legacy.id]);
    if (existing.length) continue;
    const pharmacyId = legacy.pharmacy_id ?? firstPharmacyId;
    if (!pharmacyId) continue;
    const [cashiers] = await db.query("SELECT id FROM users WHERE pharmacy_id = ? ORDER BY id LIMIT 1", [pharmacyId]);
    const cashierId = cashiers[0]?.id;
    if (!cashierId) continue;
    const total = Number(legacy.total_amount);
    const paid = Math.min(Number(legacy.paid_amount ?? 0), total);
    const status = legacy.status === "completed" ? "completed" : legacy.status === "refunded" ? "voided" : legacy.status === "cancelled" ? "cancelled" : "open";
    const createdAt = new Date(legacy.created_at);
    const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
    const [checkoutResult] = await db.query(`
      INSERT INTO checkouts (
        legacy_transaction_id, pharmacy_id, customer_id, customer_name, cashier_id,
        subtotal, discount_amount, total_amount, paid_amount, balance_amount, change_amount,
        status, expires_at, completed_at, cancelled_at, voided_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      legacy.id, pharmacyId, legacy.customer_id, legacy.customer_name, cashierId,
      String(total + Number(legacy.discount_amount ?? 0)), String(legacy.discount_amount ?? 0), String(total),
      String(paid), String(Math.max(0, total - paid)), String(legacy.change_amount ?? 0), status, expiresAt,
      status === "completed" ? createdAt : null, status === "cancelled" ? createdAt : null, status === "voided" ? createdAt : null,
      createdAt, new Date(legacy.updated_at),
    ]);
    const checkoutId = checkoutResult.insertId;
    const items = typeof legacy.items === "string" ? JSON.parse(legacy.items) : legacy.items;
    for (const item of Array.isArray(items) ? items : []) {
      const [products] = await db.query("SELECT id, name, sku, price FROM products WHERE id = ? AND pharmacy_id = ? LIMIT 1", [item.productId, pharmacyId]);
      const product = products[0];
      if (!product) continue;
      const quantity = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? product.price);
      await db.query(`
        INSERT INTO checkout_items (checkout_id, product_id, product_name, sku, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [checkoutId, product.id, item.productName ?? product.name, item.sku ?? product.sku, quantity, String(unitPrice), String(item.totalPrice ?? unitPrice * quantity)]);
    }
    if (Number(legacy.paid_amount ?? 0) > 0) {
      const method = legacy.payment_method === "cash" ? "cash" : "mpesa";
      await db.query(`
        INSERT INTO payments (
          pharmacy_id, checkout_id, method, amount, applied_amount, change_amount, status, source,
          reference_code, received_at, attached_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'attached', 'manual', ?, ?, ?, ?, ?)
      `, [pharmacyId, checkoutId, method, String(legacy.paid_amount), String(paid), String(legacy.change_amount ?? 0), legacy.reference_code, createdAt, createdAt, createdAt, new Date(legacy.updated_at)]);
    }
  }
}

if (await tableExists("sms_wallets") && await tableExists("sms_wallet_transactions")) {
  await db.query(`
    UPDATE sms_wallets w
    SET w.balance = 0
    WHERE w.balance > 0
      AND NOT EXISTS (
        SELECT 1
        FROM sms_wallet_transactions t
        WHERE t.pharmacy_id = w.pharmacy_id
          AND t.amount > 0
          AND t.type <> 'top_up_request'
      )
  `);
}

await db.end();
console.log("Pharmacy tenant migration complete");
