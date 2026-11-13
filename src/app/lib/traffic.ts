// Reads the traffic history the rate limiter keeps in KV (lib/rate-limit.ts,
// TRAFFIC_*) for /dashboard/traffic (admins only). Nothing here is public.
import "server-only";

import { kv } from "@vercel/kv";
import {
  TRAFFIC_HOUR_PREFIX,
  TRAFFIC_NOBROWSER_PREFIX,
  TRAFFIC_NOTE_PREFIX,
  type VisitorNote,
} from "@/app/lib/rate-limit";
import { parseHourKey, summarizeTraffic, type HourCount, type TrafficRow } from "@/app/lib/trafficSummary";

export const TRAFFIC_HOURS = 24;
const MAX_ROWS = 100;
const MAX_SCAN_ROUNDS = 200; // 200 × 1000 keys — far beyond this site's traffic
const CHUNK = 200;

export type TrafficSnapshot =
  | { state: "off"; reason: string }
  | {
      state: "ok";
      nowBucket: number;
      uniqueIps: number;
      totalRequests: number;
      noBrowserRequests: number;
      rows: (TrafficRow & { note: VisitorNote | null })[];
    };

export async function loadTraffic(): Promise<TrafficSnapshot> {
  if (!process.env.KV_REST_API_URL) {
    return { state: "off", reason: "Δεν έχει ρυθμιστεί το KV (KV_REST_API_URL)." };
  }

  try {
    // 1) + 2) Every hour counter still alive (they expire after 26 hours),
    // all requests and non-browser requests, with their counts.
    const entries: HourCount[] = [
      ...(await readCounters(TRAFFIC_HOUR_PREFIX, false)),
      ...(await readCounters(TRAFFIC_NOBROWSER_PREFIX, true)),
    ];

    const nowBucket = Math.floor(Date.now() / 3_600_000);
    const all = summarizeTraffic(entries, nowBucket, TRAFFIC_HOURS);
    const top = all.slice(0, MAX_ROWS);

    // 3) The User-Agent note of each listed address.
    const notes =
      top.length > 0
        ? await kv.mget<(VisitorNote | null)[]>(...top.map((r) => `${TRAFFIC_NOTE_PREFIX}${r.ip}`))
        : [];

    return {
      state: "ok",
      nowBucket,
      uniqueIps: all.length,
      totalRequests: all.reduce((s, r) => s + r.total, 0),
      noBrowserRequests: all.reduce((s, r) => s + r.noBrowser, 0),
      rows: top.map((r, i) => ({ ...r, note: notes[i] ?? null })),
    };
  } catch (e) {
    console.error("[traffic] KV read failed", e);
    return { state: "off", reason: "Η ανάγνωση από το KV απέτυχε — δείτε τα logs του server." };
  }
}

/** SCAN one counter family and MGET the counts. */
async function readCounters(prefix: string, noBrowser: boolean): Promise<HourCount[]> {
  const keys: string[] = [];
  let cursor: string | number = 0;
  for (let round = 0; round < MAX_SCAN_ROUNDS; round++) {
    const [next, batch]: [string | number, string[]] = await kv.scan(cursor, {
      match: `${prefix}*`,
      count: 1000,
    });
    keys.push(...batch);
    cursor = next;
    if (String(cursor) === "0") break;
  }

  const out: HourCount[] = [];
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    const counts = await kv.mget<(number | string | null)[]>(...chunk);
    chunk.forEach((key, j) => {
      const parsed = parseHourKey(key, prefix);
      const count = Number(counts[j] ?? 0);
      if (parsed && count > 0) out.push({ ...parsed, count, noBrowser });
    });
  }
  return out;
}
