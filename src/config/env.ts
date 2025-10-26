import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable, Please check in .env file: ${key}`);
    }
    return value;
}

export const config = {
    PORT: parseInt(process.env.PORT || '3000'),
    NODE_ENV: process.env.NODE_ENV || 'development',

    LINE_CHANNEL_ACCESS_TOKEN: requireEnv('LINE_CHANNEL_ACCESS_TOKEN'),
    LINE_CHANNEL_SECRET: requireEnv('LINE_CHANNEL_SECRET'),

    DATABASE_URL: requireEnv('DATABASE_URL'),

    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
} as const;