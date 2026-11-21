import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';

export interface NewTenant {
  id: string;
  name: string;
  apiKeyHash: string;
  botInstructions?: string | null;
}

export interface TenantProfile {
  id: string;
  name: string;
  botInstructions: string | null;
}

export interface TenantRepository {
  exists(tenantId: string): Promise<boolean>;
  findById(tenantId: string): Promise<TenantProfile | null>;
  findIdByApiKeyHash(apiKeyHash: string): Promise<string | null>;
  create(tenant: NewTenant): Promise<boolean>;
  updateBotInstructions(tenantId: string, botInstructions: string | null): Promise<TenantProfile>;
}

const profileSelect = { id: true, name: true, botInstructions: true } as const;

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async exists(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    return tenant !== null;
  }

  async findById(tenantId: string): Promise<TenantProfile | null> {
    return this.prisma.tenant.findUnique({ where: { id: tenantId }, select: profileSelect });
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

  async updateBotInstructions(
    tenantId: string,
    botInstructions: string | null,
  ): Promise<TenantProfile> {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { botInstructions },
      select: profileSelect,
    });
  }
}
