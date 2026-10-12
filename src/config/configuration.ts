// src/config/configuration.ts
import { EnvironmentVariables } from './env.validation';

export type AppConfig = {
    nodeEnv: 'development' | 'production' | 'test';
    isProduction: boolean;
    port: number;
    apiPrefix: string;

    database: {
        url: string;
        directUrl: string;
    };

    jwt: {
        accessSecret: string;
        accessTtl: string;
        refreshSecret: string;
        refreshTtl: string;
    };

    cookies: {
        domain: string;
        secure: boolean;
    };

    cors: {
        origins: string[];
    };
};

export default function configuration(): AppConfig {
    const env = validate(process.env);

    return {
        nodeEnv: env.NODE_ENV,
        isProduction: env.NODE_ENV === 'production',
        port: env.PORT,
        apiPrefix: env.API_PREFIX,

        database: {
            url: env.DATABASE_URL,
            directUrl: env.DIRECT_URL,
        },

        jwt: {
            accessSecret: env.JWT_ACCESS_SECRET,
            accessTtl: env.JWT_ACCESS_TTL,
            refreshSecret: env.JWT_REFRESH_SECRET,
            refreshTtl: env.JWT_REFRESH_TTL,
        },

        cookies: {
            domain: env.COOKIE_DOMAIN,
            secure: env.COOKIE_SECURE,
        },

        cors: {
            // Accept a comma-separated list in FRONTEND_ORIGIN
            // e.g. FRONTEND_ORIGIN="http://localhost:5173,http://localhost:4173"
            origins: env.FRONTEND_ORIGIN
                .split(',')
                .map((o) => o.trim())
                .filter((o) => o.length > 0),
        },
    };
}

// --- Internal: reuse the class-validator pipeline from env.validation.ts ---
// Imported lazily to avoid a circular import if env.validation later
// wants to read from `configuration`. Right now env.validation has no
// dependency on this file, so a direct import would also work — this
// form keeps the two files decoupled.
import { validateEnv } from './env.validation';

function validate(env: NodeJS.ProcessEnv): EnvironmentVariables {
    return validateEnv(env);
}