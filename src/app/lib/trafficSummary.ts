// Pure helpers behind /dashboard/traffic: turn the rate limiter's per-IP hour
// counters into one row per address. No I/O here (see lib/traffic.ts).
//
// Ranking deliberately ignores timing: an address is suspicious because its
// requests did not come from a browser, not because of when or how often it
// came.

export type HourCount = {
  ip: string;
  bucket: number;
  count: number;
  /** true = from the non-browser counter (requests without Sec-Fetch-* headers). */
  noBrowser?: boolean;
};

export type TrafficRow = {
  ip: string;
  /** All requests per hour, oldest first; the last cell is the current hour. */
  hours: number[];
  /** Of those, requests that did not come from a browser. */
  noBrowserHours: number[];
  total: number;
  noBrowser: number;
  /** Hours (of the window) with at least one request. */
  activeHours: number;
};

/** True when most of an address's requests came without browser headers. */
export function mostlyNotBrowser(row: Pick<TrafficRow, "total" | "noBrowser">): boolean {
  return row.total >= 3 && row.noBrowser * 2 >= row.total;
}

/**
 * `rl:v1:iph:<ip>:<bucket>` → { ip, bucket }. The IP may itself contain ':'
 * (IPv6), so the bucket is whatever follows the LAST colon.
 */
export function parseHourKey(key: string, prefix: string): { ip: string; bucket: number } | null {
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const cut = rest.lastIndexOf(":");
  if (cut <= 0) return null;
  const bucket = Number(rest.slice(cut + 1));
  if (!Number.isInteger(bucket)) return null;
  return { ip: rest.slice(0, cut), bucket };
}

/**
 * One row per IP over the `hours` hours ending at `nowBucket`, most
 * non-browser requests first, then most requests overall.
 */
export function summarizeTraffic(entries: HourCount[], nowBucket: number, hours = 24): TrafficRow[] {
  const first = nowBucket - hours + 1;
  const byIp = new Map<string, { all: number[]; nb: number[] }>();

  for (const e of entries) {
    if (e.bucket < first || e.bucket > nowBucket || !(e.count > 0)) continue;
    let row = byIp.get(e.ip);
    if (!row) {
      row = { all: new Array<number>(hours).fill(0), nb: new Array<number>(hours).fill(0) };
      byIp.set(e.ip, row);
    }
    (e.noBrowser ? row.nb : row.all)[e.bucket - first] += e.count;
  }

  const rows: TrafficRow[] = [];
  for (const [ip, { all, nb }] of byIp) {
    // The non-browser counter is a subset of the total one, but they are two
    // separate keys: never let an hour show fewer requests than non-browser ones.
    const noBrowserHours = nb;
    const hoursAll = all.map((c, i) => Math.max(c, nb[i]));
    const total = hoursAll.reduce((s, c) => s + c, 0);
    if (total === 0) continue;
    rows.push({
      ip,
      hours: hoursAll,
      noBrowserHours,
      total,
      noBrowser: noBrowserHours.reduce((s, c) => s + c, 0),
      activeHours: hoursAll.filter((c) => c > 0).length,
    });
  }

  return rows.sort((a, b) => b.noBrowser - a.noBrowser || b.total - a.total || a.ip.localeCompare(b.ip));
}
