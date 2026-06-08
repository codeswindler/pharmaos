import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const hash = await bcrypt.hash("Admin@123", 12);

await pool.query(`
  INSERT INTO users (name, email, password_hash, role, is_active)
  VALUES ($1, $2, $3, 'admin', true)
  ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = 'admin', is_active = true
`, ["System Admin", "admin@pharmaos.co.ke", hash]);

console.log("✓ Admin user ready: admin@pharmaos.co.ke / Admin@123");
await pool.end();
