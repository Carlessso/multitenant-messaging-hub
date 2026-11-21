import { z } from 'zod';

const optionalSecret = (schema: z.ZodString) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    ADMIN_API_KEY: optionalSecret(z.string().min(16)),
    LLM_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
    GEMINI_API_KEY: optionalSecret(z.string().min(1)),
    GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  })
  .refine((env) => env.LLM_PROVIDER !== 'gemini' || env.GEMINI_API_KEY !== undefined, {
    message: 'GEMINI_API_KEY is required when LLM_PROVIDER is gemini',
    path: ['GEMINI_API_KEY'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
