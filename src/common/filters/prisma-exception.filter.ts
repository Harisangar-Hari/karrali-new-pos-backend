import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Translates Prisma's `PrismaClientKnownRequestError` codes into
 * meaningful HTTP responses.
 *
 * Only well-known codes are mapped. Anything else falls through to a
 * generic 500 — the raw error is logged server-side but never returned
 * to the client.
 *
 * Registered globally via APP_FILTER in AppModule.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(PrismaExceptionFilter.name);

    catch(
        exception: Prisma.PrismaClientKnownRequestError,
        host: ArgumentsHost,
    ): void {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<Response>();
        const req = ctx.getRequest<Request>();

        const { status, message, error } = this.mapError(exception);

        // Log at warn for expected (4xx-class) errors, error for 500s.
        const logPayload = {
            code: exception.code,
            path: `${req.method} ${req.url}`,
            target: exception.meta?.target,
            field_name: exception.meta?.field_name,
        };

        if (status >= 500) {
            this.logger.error(
                `Prisma ${exception.code}: ${exception.message}`,
                JSON.stringify(logPayload),
            );
        } else {
            this.logger.warn(
                `Prisma ${exception.code} → ${status} ${message}`,
                JSON.stringify(logPayload),
            );
        }

        res.status(status).json({
            statusCode: status,
            error,
            message,
        });
    }

    private mapError(e: Prisma.PrismaClientKnownRequestError): {
        status: number;
        message: string;
        error: string;
    } {
        switch (e.code) {
            case 'P2002': {
                // Unique constraint violation
                const target = this.extractTarget(e);
                return {
                    status: HttpStatus.CONFLICT,
                    error: 'Conflict',
                    message: target
                        ? `A record with this ${target} already exists`
                        : 'A record with these values already exists',
                };
            }

            case 'P2025': {
                // Record not found (delete/update on missing row)
                return {
                    status: HttpStatus.NOT_FOUND,
                    error: 'Not Found',
                    message: 'The requested record was not found',
                };
            }

            case 'P2003': {
                // Foreign key constraint failed
                const field = this.extractFieldName(e);
                return {
                    status: HttpStatus.BAD_REQUEST,
                    error: 'Bad Request',
                    message: field
                        ? `Referenced ${field} does not exist`
                        : 'Referenced record does not exist',
                };
            }

            case 'P2011': {
                // Null constraint violation
                const field = this.extractFieldName(e);
                return {
                    status: HttpStatus.BAD_REQUEST,
                    error: 'Bad Request',
                    message: field
                        ? `Field "${field}" cannot be null`
                        : 'A required field was null',
                };
            }

            case 'P2014': {
                // Required relation violation
                return {
                    status: HttpStatus.BAD_REQUEST,
                    error: 'Bad Request',
                    message:
                        'This change would violate a required relation between records',
                };
            }

            default:
                return {
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: 'Internal Server Error',
                    message: 'A database error occurred',
                };
        }
    }

    /**
     * Prisma puts the offending column(s) in `meta.target` for P2002.
     * It's usually a string array (e.g. `['Username']`) but can be a
     * comma-separated string on some adapters.
     */
    private extractTarget(
        e: Prisma.PrismaClientKnownRequestError,
    ): string | null {
        const target = e.meta?.target;
        if (!target) return null;
        if (Array.isArray(target)) return target.join(', ');
        if (typeof target === 'string') return target;
        return null;
    }

    /**
     * P2003 puts the FK field name in `meta.field_name`.
     * Some adapters use `constraint` — not worth chasing; null is fine.
     */
    private extractFieldName(
        e: Prisma.PrismaClientKnownRequestError,
    ): string | null {
        const field = e.meta?.field_name;
        if (typeof field === 'string') return field;
        return null;
    }
}