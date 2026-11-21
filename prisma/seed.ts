import { hashApiKey } from '../src/modules/tenants/api-key.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';

const prisma = createPrismaClient(process.env['DATABASE_URL'] ?? '');

const tenants = [
  {
    id: 'loja-x',
    name: 'Loja X',
    botInstructions:
      'You are the assistant of Loja X, a clothing store. Be cordial and upbeat. We are open Monday to Saturday, 9am to 7pm, and ship nationwide.',
  },
  {
    id: 'padaria-do-joao',
    name: 'Padaria do João',
    botInstructions:
      'You are the assistant of Padaria do João, a neighborhood bakery. Be warm and informal. Fresh bread comes out at 6am and 4pm, and we deliver within 3 km.',
  },
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
