import type { PrismaClient } from '../../generated/prisma/client.js';

export interface TenantRepository {
  exists(tenantId: string): Promise<boolean>;
}

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async exists(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    return tenant !== null;
  }
}
