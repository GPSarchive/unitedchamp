import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the KV store: counts INCRs per key.
const store = new Map<string, number>();
const ttls = new Map<string, number>();
const notes = new Map<string, unknown>();
let failNext = false;
let pipelines = 0;

vi.mock("@vercel/kv", () => ({
  kv: {
    pipeline() {
      pipelines++;
      const ops: (() => number)[] = [];
      const p = {
        incr(key: string) {
          ops.push(() => {
            const n = (store.get(key) ?? 0) + 1;
            store.set(key, n);
            return n;
          });
          return p;
        },
        expire(key: string, sec: number) {
          ops.push(() => {
            ttls.set(key, sec);
            return 1;
          });
          return p;
        },
        async exec() {
          if (failNext) throw new Error("kv down");
          return ops.map((op) => op());
        },
      };
      return p;
    },
    async set(key: string, value: unknown) {
      notes.set(key, value);
      return "OK";
    },
  },
}));

async function load() {
  vi.resetModules(); // fresh circuit-breaker state per test
  return import("../rate-limit");
}

/** How many hits a key prefix has received (any time bucket). */
const hits = (prefix: string) =>
  [...store.entries()].filter(([k]) => k.startsWith(`rl:v1:${prefix}:`)).reduce((s, [, n]) => s + n, 0);

beforeEach(() => {
  store.clear();
  ttls.clear();
  notes.clear();
  failNext = false;
  pipelines = 0;
  vi.stubEnv("KV_REST_API_URL", "https://kv.test");
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("checkRequestLimits", () => {
  it("lets a normal visitor through", async () => {
    const { checkRequestLimits } = await load();
    for (let i = 0; i < 50; i++) {
      expect((await checkRequestLimits({ ip: "1.1.1.1" })).success).toBe(true);
    }
  });

  it("blocks an address after its per-minute allowance, and only that address", async () => {
    const { checkRequestLimits, LIMITS } = await load();
    for (let i = 0; i < LIMITS.ipMinute.limit; i++) {
      await checkRequestLimits({ ip: "6.6.6.6" });
    }
    const blocked = await checkRequestLimits({ ip: "6.6.6.6" });
    expect(blocked.success).toBe(false);
    expect(blocked.failedCheck).toBe("ip");

    expect((await checkRequestLimits({ ip: "1.1.1.1" })).success).toBe(true);
  });

  it("does not count blocked requests against the shared global counter", async () => {
    const { checkRequestLimits, LIMITS } = await load();
    for (let i = 0; i < LIMITS.ipMinute.limit + 200; i++) {
      await checkRequestLimits({ ip: "6.6.6.6" });
    }
    expect(hits("global")).toBe(LIMITS.ipMinute.limit);
  });

  it("gives a claimed search-engine UA a higher ceiling, not a bypass", async () => {
    const { checkRequestLimits, LIMITS } = await load();
    for (let i = 0; i < LIMITS.crawlerMinute.limit; i++) {
      const r = await checkRequestLimits({ ip: "66.249.0.1", crawler: true });
      if (!r.success) throw new Error(`blocked early at ${i}`);
    }
    const blocked = await checkRequestLimits({ ip: "66.249.0.1", crawler: true });
    expect(blocked.success).toBe(false);
    expect(LIMITS.crawlerMinute.limit).toBeGreaterThan(LIMITS.ipMinute.limit);
  });

  it("fails open when KV is down, then stops calling it for a while", async () => {
    const { checkRequestLimits } = await load();
    failNext = true;
    expect((await checkRequestLimits({ ip: "1.1.1.1" })).success).toBe(true);
    const callsAfterFailure = pipelines;
    expect((await checkRequestLimits({ ip: "1.1.1.1" })).success).toBe(true);
    expect(pipelines).toBe(callsAfterFailure); // breaker open: no new KV calls
  });
});

describe("traffic history", () => {
  it("keeps the per-IP hour counter for 26 hours, the minute counter only for its window", async () => {
    const { checkRequestLimits, TRAFFIC_KEEP_SEC } = await load();
    await checkRequestLimits({ ip: "1.1.1.1", ua: "Mozilla", path: "/matches" });
    const ttlOf = (prefix: string) => [...ttls.entries()].find(([k]) => k.startsWith(`rl:v1:${prefix}:`))?.[1];
    expect(ttlOf("iph:1.1.1.1")).toBe(TRAFFIC_KEEP_SEC);
    expect(ttlOf("ip:1.1.1.1")).toBe(60);
  });

  it("notes the User-Agent and path once per hour per address", async () => {
    const { checkRequestLimits } = await load();
    await checkRequestLimits({ ip: "1.1.1.1", ua: "Mozilla", path: "/matches", browser: true });
    await checkRequestLimits({ ip: "1.1.1.1", ua: "Mozilla", path: "/other", browser: true });
    expect(notes.get("rl:visitor:1.1.1.1")).toMatchObject({ ua: "Mozilla", path: "/matches", browser: true });
  });

  it("counts requests without browser headers separately, and notes the first one", async () => {
    const { checkRequestLimits } = await load();
    await checkRequestLimits({ ip: "1.1.1.1", ua: "Mozilla", path: "/matches", browser: true });
    await checkRequestLimits({ ip: "1.1.1.1", ua: "node", path: "/api/matches/explorer", browser: false });
    await checkRequestLimits({ ip: "1.1.1.1", ua: "node", path: "/api/matches/explorer", browser: false });

    expect(hits("iph:1.1.1.1")).toBe(3);
    expect(hits("iphx:1.1.1.1")).toBe(2);
    // The note now shows the non-browser client, not the earlier browser one.
    expect(notes.get("rl:visitor:1.1.1.1")).toMatchObject({ ua: "node", browser: false });
  });

  it("never blocks on the non-browser counter", async () => {
    const { checkRequestLimits } = await load();
    for (let i = 0; i < 100; i++) {
      expect((await checkRequestLimits({ ip: "2.2.2.2", browser: false })).success).toBe(true);
    }
  });
});

describe("checkLimit", () => {
  it("reports remaining and blocks past the limit", async () => {
    const { checkLimit } = await load();
    expect(await checkLimit("k", 2, 60)).toMatchObject({ success: true, remaining: 1 });
    expect(await checkLimit("k", 2, 60)).toMatchObject({ success: true, remaining: 0 });
    expect(await checkLimit("k", 2, 60)).toMatchObject({ success: false, remaining: 0 });
  });

  it("is off in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { checkLimit } = await load();
    for (let i = 0; i < 5; i++) expect((await checkLimit("k", 1, 60)).success).toBe(true);
    expect(pipelines).toBe(0);
  });
});
