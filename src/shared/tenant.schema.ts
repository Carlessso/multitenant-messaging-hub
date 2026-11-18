import { z } from 'zod';

export const tenantParamsSchema = z.object({
  tenantId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'must contain only lowercase letters, numbers and hyphens'),
});

export type TenantParams = z.infer<typeof tenantParamsSchema>;
