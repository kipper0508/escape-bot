import { config } from '../config/env.js';

const isDev = config.NODE_ENV === 'development';

export const logger = {
    
    info: (message: string, meta?: any) => {
        console.log(`[INFO] ${message}`, meta || '');
    },

    warn: (message: string, meta?: any) => {
        console.warn(`[WARN] ${message}`, meta || '');
    },

    error: (message: string, error?: Error, meta?: any) => {
        console.error(`[ERROR] ${message}`, {
            error: error?.message,
            stack: isDev ? error?.stack : undefined,
            ...meta
        });
    },

    debug: (message: string, meta?: any) => {
        if (isDev) {
            console.debug(`[DEBUG] ${message}`, meta || '');
        }
    }
};
