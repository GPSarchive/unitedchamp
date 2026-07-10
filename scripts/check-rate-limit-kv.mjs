/**
 * check-rate-limit-kv.mjs — verifies the rate limiter's Redis store is alive.
 *
 * Talks to the Upstash REST endpoint exactly like @vercel/kv does, using
 * KV_REST_API_URL / KV_REST_API_TOKEN from .env.local. Read-mostly: it PINGs,
 * then INCR+EXPIREs one probe key in the rate limiter's own namespace
 * (rl:v1:probe:*), which expires in 60s.
 *
 * Usage: node scripts/check-rate-limit-kv.mjs
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }),
);

const url = env.KV_REST_API_URL;
const token = env.KV_REST_API_TOKEN;
if (!url || !token) {
  console.log("KV_REST_API_URL / KV_REST_API_TOKEN not set in .env.local — rate limiting is cleanly disabled (checkLimit short-circuits).");
  process.exit(0);
}

const cmd = async (...args) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`HTTP ${res.status}: ${body.error ?? JSON.stringify(body)}`);
  return body.result;
};

try {
  console.log(`store: ${new URL(url).hostname}`);
  console.log(`PING -> ${await cmd("PING")}`);
  const key = "rl:v1:probe:check-script";
  const n = await cmd("INCR", key);
  await cmd("EXPIRE", key, 60);
  console.log(`INCR/EXPIRE ok (${key} = ${n}, TTL 60s) — the rate limiter will work.`);
} catch (e) {
  console.error(`FAILED: ${e.message}`);
  console.error("The store is unreachable — rate limiting is failing open in production.");
  console.error("See docs/setup-rate-limiting.md to recreate it via the Vercel Marketplace.");
  process.exit(1);
}
