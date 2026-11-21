import { z } from 'zod';

export const BOT_INSTRUCTIONS_MAX_LENGTH = 2000;

export const botInstructionsSchema = z
  .string()
  .trim()
  .max(BOT_INSTRUCTIONS_MAX_LENGTH)
  .nullable()
  .transform((value) => (value ? value : null));
