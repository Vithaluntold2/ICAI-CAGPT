/* One-off: create/upsert a user. Usage:
 *   npx tsx --env-file=.env scripts/_create-user.ts <email> <password> [--admin]
 */
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const [, , email, password, ...rest] = process.argv;
if (!email || !password) {
  console.error('Usage: npx tsx --env-file=.env scripts/_create-user.ts <email> <password> [--admin]');
  process.exit(1);
}
const isAdmin = rest.includes('--admin');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function main() {
  const hashed = await bcrypt.hash(password, 10);
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users
       SET password = $1, is_admin = $2, subscription_tier = 'professional'
       WHERE email = $3`,
      [hashed, isAdmin, email]
    );
    console.log(`✓ Updated user ${email} (id=${existing.rows[0].id}) isAdmin=${isAdmin}`);
  } else {
    const id = randomUUID();
    const nameFromEmail = email.split('@')[0];
    await pool.query(
      `INSERT INTO users (id, email, password, name, subscription_tier, is_admin, created_at)
       VALUES ($1, $2, $3, $4, 'professional', $5, NOW())`,
      [id, email, hashed, nameFromEmail, isAdmin]
    );
    console.log(`✓ Created user ${email} (id=${id}) isAdmin=${isAdmin}`);
  }
}

main()
  .catch(e => { console.error('FAILED:', e); process.exit(1); })
  .finally(() => pool.end());
