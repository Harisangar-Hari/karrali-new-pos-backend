import { PageMeta, PaginatedResponse } from '../dto/pagination.dto';

/**
 * Structural shape a Prisma model delegate must satisfy for `paginate`.
 *
 * We deliberately don't try to mirror Prisma's conditional return type
 * (`findMany({ include })` returns a different row shape than `findMany()`).
 * That info can't be expressed in a single-signature interface. The
 * caller declares `<T>` explicitly — usually via `Prisma.XGetPayload<...>`
 * — and we trust it, exactly the way we trust the `args` object at the
 * call site.
 */
export interface PrismaListDelegate {
    findMany(args?: any): Promise<any>;
    count(args?: any): Promise<number>;
}

export interface PaginateArgs {
    where?: any;
    orderBy?: any;
    select?: any;
    include?: any;
    distinct?: any;
}

/**
 * Runs `findMany` + `count` in parallel and wraps the result in the
 * standard `{ data, meta }` envelope used by every list endpoint.
 *
 * `skip` / `take` are injected here — callers must NOT pass them in
 * `args` (they'd be overwritten anyway).
 */
export async function paginate<T>(
    delegate: PrismaListDelegate,
    args: PaginateArgs,
    page: number,
    limit: number,
): Promise<PaginatedResponse<T>> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        delegate.findMany({ ...args, skip, take: limit }) as Promise<T[]>,
        delegate.count({ where: args.where }),
    ]);

    return { data, meta: buildPageMeta(page, limit, total) };
}

/**
 * Builds the meta block for a known total. Exposed separately for
 * callers that already have a count from an earlier query.
 */
export function buildPageMeta(
    page: number,
    limit: number,
    total: number,
): PageMeta {
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
}