import dotenv from 'dotenv';
dotenv.config({ override: true });

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  dbPath: process.env.DB_PATH ?? './data/receptionist.db',
} as const;

if (!config.anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY is required');
}
