import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL ?? process.env.MYSQL_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or MYSQL_URL must be set to a MySQL connection string");
}

const pool = mysql.createPool(databaseUrl);
const hash = await bcrypt.hash("Admin@123", 12);

await pool.query(
  `
    INSERT INTO users (name, email, phone, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, 'super_admin', true)
    ON DUPLICATE KEY UPDATE
      password_hash = VALUES(password_hash),
      role = 'super_admin',
      is_active = true
  `,
  ["System Admin", "admin@pharmaos.co.ke", "254700000001", hash],
);

console.log("Admin user ready: admin@pharmaos.co.ke / Admin@123");
await pool.end();
