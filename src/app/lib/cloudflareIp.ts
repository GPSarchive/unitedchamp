// The site's domain is proxied by Cloudflare (DNS → Cloudflare, orange cloud),
// so the address Vercel sees in x-forwarded-for is a Cloudflare edge server
// shared by many visitors. The real visitor is in cf-connecting-ip — but that
// header is only trustworthy when the request really came from Cloudflare;
// anyone hitting Vercel directly could send it with any value.
//
// Ranges: https://www.cloudflare.com/ips/ (stable for years; update if it changes).

const V4: [number, number][] = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
].map((cidr) => {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return [(v4ToInt(base)! & mask) >>> 0, mask];
});

// [first 16-bit group, second group low, second group high]
const V6: [number, number, number][] = [
  [0x2400, 0xcb00, 0xcb00], // 2400:cb00::/32
  [0x2606, 0x4700, 0x4700], // 2606:4700::/32
  [0x2803, 0xf800, 0xf800], // 2803:f800::/32
  [0x2405, 0xb500, 0xb500], // 2405:b500::/32
  [0x2405, 0x8100, 0x8100], // 2405:8100::/32
  [0x2a06, 0x98c0, 0x98c7], // 2a06:98c0::/29
  [0x2c0f, 0xf248, 0xf248], // 2c0f:f248::/32
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n >>> 0;
}

export function isCloudflareIp(ip: string): boolean {
  const v4 = v4ToInt(ip.startsWith("::ffff:") ? ip.slice(7) : ip);
  if (v4 !== null) return V4.some(([net, mask]) => ((v4 & mask) >>> 0) === net);

  if (!ip.includes(":") || ip.startsWith("::")) return false;
  const groups = ip.split(":");
  const g0 = parseInt(groups[0], 16);
  const g1 = groups[1] === "" ? 0 : parseInt(groups[1], 16);
  if (Number.isNaN(g0) || Number.isNaN(g1)) return false;
  return V6.some(([a, lo, hi]) => g0 === a && g1 >= lo && g1 <= hi);
}
