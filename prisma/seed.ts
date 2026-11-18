import { createPrismaClient } from '../src/shared/database/prisma.js';

const prisma = createPrismaClient(process.env['DATABASE_URL'] ?? '');

const tenants = [
  { id: 'loja-x', name: 'Loja X' },
  { id: 'padaria-do-joao', name: 'Padaria do João' },
];

for (const tenant of tenants) {
  await prisma.tenant.upsert({
    where: { id: tenant.id },
    create: { id: tenant.id, name: tenant.name }, //or simply 'create: tenant'
    update: { name: tenant.name },
  });
}

await prisma.$disconnect();
