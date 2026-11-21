import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateApiKey(): string {
  return `hub_${randomBytes(32).toString('base64url')}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export function bearerToken(authorization: string | undefined): string | undefined {
  const [scheme, token] = authorization?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : undefined;
}

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
