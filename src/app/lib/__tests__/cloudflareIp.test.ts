import { describe, expect, it, vi } from "vitest";

vi.mock("@vercel/kv", () => ({ kv: {} }));

import { isCloudflareIp } from "../cloudflareIp";
import { ipFromRequest } from "../rate-limit";

const req = (h: Record<string, string>) => new Request("https://x.test/", { headers: h });

describe("isCloudflareIp", () => {
  it("recognises Cloudflare edge addresses", () => {
    expect(isCloudflareIp("172.68.62.250")).toBe(true);
    expect(isCloudflareIp("172.71.99.170")).toBe(true);
    expect(isCloudflareIp("104.21.93.152")).toBe(true);
    expect(isCloudflareIp("2606:4700:3036::ac43:d3b4")).toBe(true);
    expect(isCloudflareIp("2a06:98c7::1")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isCloudflareIp("79.107.1.2")).toBe(false); // Greek ISP
    expect(isCloudflareIp("172.72.0.1")).toBe(false); // just past 172.64.0.0/13
    expect(isCloudflareIp("2a02:587:1::7")).toBe(false);
    expect(isCloudflareIp("2a06:98c8::1")).toBe(false);
    expect(isCloudflareIp("garbage")).toBe(false);
  });
});

describe("ipFromRequest", () => {
  it("uses cf-connecting-ip when the request came through Cloudflare", () => {
    expect(
      ipFromRequest(req({ "x-forwarded-for": "172.68.62.250", "cf-connecting-ip": "79.107.1.2" }))
    ).toBe("79.107.1.2");
  });

  it("ignores cf-connecting-ip from anyone who is not Cloudflare", () => {
    expect(
      ipFromRequest(req({ "x-forwarded-for": "18.207.0.1", "cf-connecting-ip": "1.2.3.4" }))
    ).toBe("18.207.0.1");
  });

  it("falls back to the connecting address", () => {
    expect(ipFromRequest(req({ "x-forwarded-for": "79.107.1.2, 10.0.0.1" }))).toBe("79.107.1.2");
    expect(ipFromRequest(req({}))).toBe("127.0.0.1");
  });
});
