import { parse } from 'pg-connection-string';
import { Pool, type PoolConfig } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

type PgConnectionOptions = ReturnType<typeof parse> & { sslmode?: string };

function getPoolConfig(): PoolConfig | undefined {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return undefined;

  const parsed = parse(connectionString) as PgConnectionOptions;
  const port = parsed.port ? parseInt(parsed.port, 10) : undefined;
  if (port !== undefined && (Number.isNaN(port) || port < 1 || port > 65535)) {
    throw new Error(`Invalid database port in DATABASE_URL: ${parsed.port}`);
  }

  const host = parsed.host ?? '';
  const sslmode = parsed.sslmode;
  let ssl: PoolConfig['ssl'];

  if (sslmode === 'disable' || parsed.ssl === false) {
    ssl = false;
  } else if (
    sslmode === 'require' ||
    sslmode === 'prefer' ||
    sslmode === 'allow' ||
    parsed.ssl === true
  ) {
    // Encrypt the connection; do not require a specific CA for maximum compatibility.
    ssl = { rejectUnauthorized: false };
  } else if (sslmode === 'verify-ca' || sslmode === 'verify-full') {
    ssl = { rejectUnauthorized: true };
  } else if (parsed.ssl && typeof parsed.ssl === 'object') {
    ssl = parsed.ssl as PoolConfig['ssl'];
  } else if (host.includes('supabase.co')) {
    // Supabase PostgreSQL requires TLS.
    ssl = { rejectUnauthorized: false };
  }

  return {
    host: host || undefined,
    port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database ?? undefined,
    ssl,
  };
}

let prisma: PrismaClient;

const poolConfig = getPoolConfig();

if (poolConfig) {
  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  prisma = globalForPrisma.prisma || new PrismaClient({ adapter });
} else {
  // Fallback for when DATABASE_URL is not set (e.g., during build without DB)
  // Note: This will not work for database queries but allows type generation
  prisma = globalForPrisma.prisma || new PrismaClient();
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { prisma };
