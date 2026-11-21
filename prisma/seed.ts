import { hashApiKey } from '../src/modules/tenants/api-key.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';

const prisma = createPrismaClient(process.env['DATABASE_URL'] ?? '');

const tenants = [
  { id: 'loja-x', name: 'Loja X' },
  { id: 'padaria-do-joao', name: 'Padaria do João' },
];

for (const tenant of tenants) {
  const apiKeyHash = hashApiKey(`hub_dev_${tenant.id}`);
  await prisma.tenant.upsert({
    where: { id: tenant.id },
    create: { ...tenant, apiKeyHash },
    update: { name: tenant.name, apiKeyHash },
  });
}

await prisma.$disconnect();
