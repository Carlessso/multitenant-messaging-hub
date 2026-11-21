import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';

export interface NewTenant {
  id: string;
  name: string;
  apiKeyHash: string;
}

export interface TenantRepository {
  exists(tenantId: string): Promise<boolean>;
  findIdByApiKeyHash(apiKeyHash: string): Promise<string | null>;
  create(tenant: NewTenant): Promise<boolean>;
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

  async findIdByApiKeyHash(apiKeyHash: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { apiKeyHash },
      select: { id: true },
    });
    return tenant?.id ?? null;
  }

  async create(tenant: NewTenant): Promise<boolean> {
    try {
      await this.prisma.tenant.create({ data: tenant });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
