import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '.env.local' });

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    url: process.env.DATABASE_URL,
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
