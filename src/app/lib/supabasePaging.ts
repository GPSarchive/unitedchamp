// Shared service-role read helpers that paginate past PostgREST's ~1000-row
// response cap (a large .limit() does NOT override it). Every stats/standings
// engine read must go through these or paginate itself.
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { chunk } from "@/app/lib/playerStatsAggregation";

/** Rows per PostgREST page (kept under the server max-rows setting). */
export const PAGE_SIZE = 500;
/** Ids per IN (...) clause / rows per upsert payload. */
export const BATCH_SIZE = 300;

/**
 * Fetch every row of `table` where `idColumn IN ids`, in id batches, each
 * batch paginated. Row order = batch order, then `orderColumn` within a batch.
 */
export async function fetchInBatches<T>(
  table: string,
  idColumn: string,
  ids: number[],
  selectColumns: string,
  orderColumn = "id",
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (const batch of chunk(ids, BATCH_SIZE)) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(selectColumns)
        .in(idColumn, batch)
        .order(orderColumn, { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
      if (!data || data.length === 0) break;
      out.push(...(data as T[]));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return out;
}

/** Fetch an entire table (optionally filtered by `eq`), paginated by `orderColumn`. */
export async function fetchAllRows<T>(
  table: string,
  selectColumns: string,
  orderColumn = "id",
  eq?: { column: string; value: string | number },
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    let q = supabaseAdmin
      .from(table)
      .select(selectColumns)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (eq) q = q.eq(eq.column, eq.value);
    const { data, error } = await q;
    if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}
