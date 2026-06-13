import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL ?? process.env.MYSQL_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or MYSQL_URL must be set");

const db = await mysql.createConnection(databaseUrl);
const pharmacyEmail = process.env.DEMO_PHARMACY_EMAIL ?? "demo@pharmaos.co.ke";
const [[pharmacy]] = await db.query("SELECT id, name FROM pharmacies WHERE email = ? LIMIT 1", [pharmacyEmail]);

if (!pharmacy) {
  await db.end();
  throw new Error(`Demo pharmacy not found for ${pharmacyEmail}`);
}

await db.beginTransaction();
try {
  await db.query(`
    UPDATE message_recipients mr
    JOIN payments p ON p.id = mr.payment_id
    SET mr.payment_id = NULL
    WHERE p.pharmacy_id = ?
  `, [pharmacy.id]);
  await db.query("DELETE FROM payments WHERE pharmacy_id = ?", [pharmacy.id]);
  await db.query("DELETE ci FROM checkout_items ci JOIN checkouts c ON c.id = ci.checkout_id WHERE c.pharmacy_id = ?", [pharmacy.id]);
  await db.query("DELETE FROM checkouts WHERE pharmacy_id = ?", [pharmacy.id]);
  await db.query("UPDATE products SET reserved_qty = 0 WHERE pharmacy_id = ?", [pharmacy.id]);
  await db.query(`
    UPDATE customers
    SET total_spend = 0, visit_count = 0, loyalty_points = 0, last_visit = NULL
    WHERE pharmacy_id = ?
  `, [pharmacy.id]);
  await db.commit();
  console.log(`Cleared all sales history for ${pharmacy.name}. Products, users, and SMS campaigns were preserved.`);
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
