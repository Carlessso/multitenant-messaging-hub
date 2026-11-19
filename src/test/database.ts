import type { PrismaClient } from '../generated/prisma/client.js';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createPrismaClient } from '../shared/database/prisma.js';
import { execFileSync } from 'node:child_process';

export interface TestDatabase {
  url: string;
  prisma: PrismaClient;
  stop(): Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start();
  const databaseUrl = container.getConnectionUri();
  const prisma = createPrismaClient(databaseUrl);

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  return {
    url: databaseUrl,
    prisma,
    stop: async () => {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.tenant.deleteMany();
}
