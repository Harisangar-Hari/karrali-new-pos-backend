import { Prisma } from '@prisma/client';

/**
 * Allocate the next code for a given prefix, e.g. `CUST-00042`.
 *
 * Race-safe across concurrent callers: the INSERT ... ON CONFLICT
 * is a single atomic statement at the Postgres level, so two
 * terminals calling simultaneously get different numbers even if
 * they hit the DB at the same millisecond.
 *
 * MUST be called inside a `$transaction` — the caller's transaction
 * guarantees the code isn't rolled back into a gap while the row
 * it's attached to commits. Passing the tx client is required.
 *
 * @param tx     Prisma transaction client (from `$transaction`)
 * @param prefix Sequence key, e.g. 'CUST', 'SUP', 'INV'
 * @param pad    Zero-pad width. Default 5 → CUST-00001.
 */
export async function nextCode(
    tx: Prisma.TransactionClient,
    prefix: string,
    pad = 5,
): Promise<string> {
    const rows = await tx.$queryRaw<{ LastNumber: number }[]>`
        INSERT INTO "CodeSequences" ("Prefix", "LastNumber", "UpdatedAt")
        VALUES (${prefix}, 1, NOW())
        ON CONFLICT ("Prefix") DO UPDATE
            SET "LastNumber" = "CodeSequences"."LastNumber" + 1,
                "UpdatedAt"  = NOW()
        RETURNING "LastNumber"
    `;

    const n = rows[0]?.LastNumber ?? 1;
    return `${prefix}-${String(n).padStart(pad, '0')}`;
}