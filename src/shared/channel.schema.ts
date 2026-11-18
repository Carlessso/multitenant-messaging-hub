import { z } from 'zod';

export const channelSchema = z.enum(['whatsapp', 'instagram']);

export type Channel = z.infer<typeof channelSchema>;
