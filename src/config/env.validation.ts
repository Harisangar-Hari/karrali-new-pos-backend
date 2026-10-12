// src/config/env.validation.ts
import { plainToInstance } from 'class-transformer';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsString,
    Max,
    Min,
    MinLength,
    validateSync,
} from 'class-validator';

enum NodeEnv {
    Development = 'development',
    Production = 'production',
    Test = 'test',
}

export  class EnvironmentVariables {
    @IsEnum(NodeEnv)
    NODE_ENV: NodeEnv = NodeEnv.Development;

    @IsInt()
    @Min(1)
    @Max(65535)
    PORT: number = 3000;

    @IsString()
    @MinLength(1)
    API_PREFIX: string = 'api';

    // --- Database ---
    @IsString()
    @MinLength(1)
    DATABASE_URL: string;

    @IsString()
    @MinLength(1)
    DIRECT_URL: string;

    // --- JWT ---
    @IsString()
    @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 chars' })
    JWT_ACCESS_SECRET: string;

    @IsString()
    @MinLength(2)
    JWT_ACCESS_TTL: string = '15m';

    @IsString()
    @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 chars' })
    JWT_REFRESH_SECRET: string;

    @IsString()
    @MinLength(2)
    JWT_REFRESH_TTL: string = '7d';

    // --- Cookies ---
    @IsString()
    COOKIE_DOMAIN: string = 'localhost';

    @IsBoolean()
    COOKIE_SECURE: boolean = false;

    // --- CORS ---
    // Kept as plain string (not IsUrl) so a future comma-separated
    // list of origins works without changing this file.
    @IsString()
    @MinLength(1)
    FRONTEND_ORIGIN: string = 'http://localhost:5173';
}

export function validateEnv(
    config: Record<string, unknown>,
): EnvironmentVariables {
    const validated = plainToInstance(EnvironmentVariables, config, {
        enableImplicitConversion: true,
        exposeDefaultValues: true,
    });

    const errors = validateSync(validated, {
        skipMissingProperties: false,
        whitelist: false, // don't strip extra env vars — only validate what we declare
    });

    if (errors.length > 0) {
        const messages = errors
            .map((err) => {
                const constraints = err.constraints
                    ? Object.values(err.constraints).join(', ')
                    : 'unknown validation error';
                return `  - ${err.property}: ${constraints}`;
            })
            .join('\n');

        throw new Error(
            `❌ Invalid environment configuration:\n${messages}\n\n` +
            `Check your .env file (see .env.example for required keys).`,
        );
    }

    return validated;
}