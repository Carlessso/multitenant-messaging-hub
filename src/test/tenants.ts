import type { PrismaClient } from '../generated/prisma/client.js';
import { generateApiKey, hashApiKey } from '../modules/tenants/api-key.js';

export async function createTenant(prisma: PrismaClient, id: string, name = id): Promise<string> {
  const apiKey = generateApiKey();
  await prisma.tenant.create({ data: { id, name, apiKeyHash: hashApiKey(apiKey) } });
  return apiKey;
}
