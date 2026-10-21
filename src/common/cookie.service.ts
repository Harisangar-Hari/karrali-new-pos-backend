import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AppConfig } from '../config/configuration';

export const ACCESS_COOKIE = 'karrali_access';
export const REFRESH_COOKIE = 'karrali_refresh';

@Injectable()
export class CookieService {
    private readonly base: CookieOptions;

    constructor(private readonly config: ConfigService<AppConfig, true>) {
        this.base = {
            httpOnly: true,
            secure: this.config.get('cookies.secure', { infer: true }),
            sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as
                | 'none'
                | 'lax',
            domain: config.get('cookies.domain', { infer: true }) || undefined,
            path: '/',
        };
    }

    setAccess(res: Response, token: string, maxAgeSeconds: number): void {
        res.cookie(ACCESS_COOKIE, token, {
            ...this.base,
            maxAge: maxAgeSeconds * 1000,
        });
    }

    setRefresh(res: Response, token: string, maxAgeSeconds: number): void {
        res.cookie(REFRESH_COOKIE, token, {
            ...this.base,
            maxAge: maxAgeSeconds * 1000,
        });
    }

    clear(res: Response): void {
        res.clearCookie(ACCESS_COOKIE, this.base);
        res.clearCookie(REFRESH_COOKIE, this.base);
    }
}