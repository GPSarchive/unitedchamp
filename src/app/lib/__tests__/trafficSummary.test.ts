import { describe, expect, it } from "vitest";
import { mostlyNotBrowser, parseHourKey, summarizeTraffic } from "../trafficSummary";

const P = "rl:v1:iph:";

describe("parseHourKey", () => {
  it("reads IPv4 and IPv6 keys", () => {
    expect(parseHourKey(`${P}1.2.3.4:493000`, P)).toEqual({ ip: "1.2.3.4", bucket: 493000 });
    expect(parseHourKey(`${P}2a02:587:1::7:493000`, P)).toEqual({ ip: "2a02:587:1::7", bucket: 493000 });
    expect(parseHourKey("rl:v1:iphx:9.9.9.9:493000", "rl:v1:iphx:")).toEqual({ ip: "9.9.9.9", bucket: 493000 });
  });

  it("rejects other keys", () => {
    expect(parseHourKey("rl:v1:ip:1.2.3.4:29000000", P)).toBeNull();
    expect(parseHourKey(`${P}1.2.3.4`, P)).toBeNull();
    expect(parseHourKey(`${P}1.2.3.4:abc`, P)).toBeNull();
  });
});

describe("summarizeTraffic", () => {
  const now = 1000;

  it("ranks by non-browser requests, not by volume or timing", () => {
    const rows = summarizeTraffic(
      [
        // A busy human: lots of requests, all from a browser.
        { ip: "5.5.5.5", bucket: now - 3, count: 900 },
        // A script that came once, three requests, no browser headers.
        { ip: "18.207.0.1", bucket: now - 7, count: 3 },
        { ip: "18.207.0.1", bucket: now - 7, count: 3, noBrowser: true },
      ],
      now
    );
    expect(rows.map((r) => r.ip)).toEqual(["18.207.0.1", "5.5.5.5"]);
    expect(rows[0]).toMatchObject({ total: 3, noBrowser: 3 });
    expect(rows[1]).toMatchObject({ total: 900, noBrowser: 0 });
  });

  it("places counts in the right hour cell, oldest first", () => {
    const [row] = summarizeTraffic(
      [
        { ip: "a", bucket: now, count: 3 },
        { ip: "a", bucket: now - 23, count: 1 },
        { ip: "a", bucket: now - 23, count: 1, noBrowser: true },
      ],
      now
    );
    expect(row.hours).toHaveLength(24);
    expect(row.hours[0]).toBe(1);
    expect(row.noBrowserHours[0]).toBe(1);
    expect(row.hours[23]).toBe(3);
    expect(row.noBrowserHours[23]).toBe(0);
    expect(row.activeHours).toBe(2);
  });

  it("never shows an hour with fewer requests than non-browser ones", () => {
    const [row] = summarizeTraffic([{ ip: "a", bucket: now, count: 4, noBrowser: true }], now);
    expect(row.hours[23]).toBe(4);
    expect(row.total).toBe(4);
  });

  it("ignores hours outside the window", () => {
    const rows = summarizeTraffic(
      [
        { ip: "a", bucket: now - 24, count: 50 },
        { ip: "a", bucket: now + 1, count: 50, noBrowser: true },
      ],
      now
    );
    expect(rows).toEqual([]);
  });
});

describe("mostlyNotBrowser", () => {
  it("needs a few requests and at least half without a browser", () => {
    expect(mostlyNotBrowser({ total: 2, noBrowser: 2 })).toBe(false);
    expect(mostlyNotBrowser({ total: 3, noBrowser: 2 })).toBe(true);
    expect(mostlyNotBrowser({ total: 10, noBrowser: 5 })).toBe(true);
    expect(mostlyNotBrowser({ total: 10, noBrowser: 4 })).toBe(false);
  });
});
