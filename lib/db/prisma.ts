import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = process.env.DATABASE_URL;

let prisma: PrismaClient;

if (connectionString) {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prisma = globalForPrisma.prisma || new PrismaClient({ adapter });
} else {
  // Fallback for when DATABASE_URL is not set (e.g., during build without DB)
  // Note: This will not work for database queries but allows type generation
  prisma = globalForPrisma.prisma || new PrismaClient();
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { prisma };
