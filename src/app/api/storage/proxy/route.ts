// app/api/proxy/route.ts
import { NextRequest } from "next/server";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("src");
  if (!url) return new Response("Missing src", { status: 400 });
  const res = await fetch(url, { headers: { Accept: "image/*" } });
  if (!res.ok || !res.body) return new Response("Fetch failed", { status: 502 });
  const ct = res.headers.get("content-type") || "image/png";
  return new Response(res.body, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
