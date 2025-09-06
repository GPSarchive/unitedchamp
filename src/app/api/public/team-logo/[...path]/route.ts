// app/api/public/team-logo/[...path]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// Force Node runtime (safer for storage downloads)
export const runtime = "nodejs";
// Ensure no static caching of the handler itself
export const dynamic = "force-dynamic";

// ⚠️ MUST MATCH the bucket used by your uploader exactly
const BUCKET = "GPSarchive's Project";

// Minimal, safe path validator (no leading "/", no "..", no empty segments)
function toSafePath(segments: string[] | undefined): string | null {
  try {
    const raw = (segments ?? []).join("/");
    const p = decodeURIComponent(raw);
    if (!p || p.startsWith("/") || p.includes("..")) return null;
    const parts = p.split("/");
    if (parts.some(seg => !seg || seg === ".")) return null;
    return p;
  } catch {
    return null;
  }
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
};

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { path } = await ctx.params; // ← Next 15: params is a Promise
  const objectPath = toSafePath(path);
  if (!objectPath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Try the download and surface any error (don’t silently 404)
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(objectPath);

  if (error || !data) {
    // Helpful diagnostics in dev logs and response
    console.error("LOGO PROXY DOWNLOAD FAILED:", { BUCKET, objectPath, error });
    return NextResponse.json(
      {
        error: "Storage download failed",
        bucket: BUCKET,
        path: objectPath,
        details: String((error as any)?.message || error),
      },
      { status: 502 } // backend read failure
    );
  }

  const ext = objectPath.split(".").pop()?.toLowerCase() ?? "";
  const fallbackType = MIME[ext] ?? "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", (asAny(data).type as string) || fallbackType);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  // Blob in some environments, Node stream in others
  if (typeof asAny(data).arrayBuffer === "function") {
    const ab = await (data as Blob).arrayBuffer();
    return new NextResponse(Buffer.from(ab), { status: 200, headers });
  } else {
    const { Readable } = await import("node:stream");
    // @ts-ignore Node 18+
    const webStream = Readable.toWeb(data as any);
    return new NextResponse(webStream as any, { status: 200, headers });
  }
}

function asAny<T>(v: T): any {
  return v as any;
}
