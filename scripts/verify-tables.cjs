const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const tablesRes = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
  );
  const tables = tablesRes.rows.map((r) => r.table_name);
  console.log(`\nTotal tables: ${tables.length}`);
  tables.forEach((t) => console.log(`  - ${t}`));

  const migrationsRes = await pool.query(
    `SELECT migration_name, finished_at FROM public._prisma_migrations ORDER BY migration_name;`
  );
  console.log(`\nPrisma migrations: ${migrationsRes.rows.length}`);
  migrationsRes.rows.forEach((r) => {
    console.log(`  - ${r.migration_name} | applied: ${r.finished_at ? r.finished_at.toISOString() : 'NO'}`);
  });

  await pool.end();
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
