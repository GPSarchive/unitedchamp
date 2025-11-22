// app/api/teams/extract-color/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

const BUCKET = "GPSarchive's Project";

/* =======================
   Color extraction utilities
   ======================= */

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Convert RGB to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

/**
 * Calculate perceived brightness of a color (0-255)
 */
function getBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Calculate color saturation (0-1)
 */
function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Extract dominant color from image using canvas
 * This is a server-side implementation using node-canvas or similar
 */
async function extractColorFromImage(imageBuffer: Buffer): Promise<string> {
  // Use sharp library for image processing (install: npm install sharp)
  const sharp = require('sharp');

  try {
    // Resize image to small size for faster processing
    const resized = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const { width, height, channels } = info;

    // Count colors, but skip very bright/dark pixels and low saturation
    const colorCounts = new Map<string, { count: number; rgb: RGB }>();

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;

      // Skip transparent pixels
      if (a < 128) continue;

      // Skip very bright (likely white/background) or very dark pixels
      const brightness = getBrightness(r, g, b);
      if (brightness > 240 || brightness < 15) continue;

      // Skip low saturation (grayscale) pixels
      const saturation = getSaturation(r, g, b);
      if (saturation < 0.2) continue;

      // Quantize colors to reduce variations (group similar colors)
      const qr = Math.round(r / 10) * 10;
      const qg = Math.round(g / 10) * 10;
      const qb = Math.round(b / 10) * 10;
      const key = `${qr},${qg},${qb}`;

      const existing = colorCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        colorCounts.set(key, { count: 1, rgb: { r: qr, g: qg, b: qb } });
      }
    }

    // Find most common color
    let maxCount = 0;
    let dominantColor: RGB = { r: 0, g: 128, b: 255 }; // default blue

    for (const [_, { count, rgb }] of colorCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = rgb;
      }
    }

    return rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b);
  } catch (error) {
    console.error("Color extraction error:", error);
    // Return default color on error
    return "#0080ff";
  }
}

/**
 * Fetch image from URL (supports both external URLs and signed storage URLs)
 */
async function fetchImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/* =======================
   Same-origin guard
   ======================= */
function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  const whitelist = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  try {
    whitelist.add(new URL(req.url).origin);
  } catch {
    // ignore
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const ok = [origin, referer].some((val) => {
    try {
      return !!val && whitelist.has(new URL(val).origin);
    } catch {
      return false;
    }
  });

  if (!ok) throw new Error("bad-origin");
}

/* ==============
   Storage helpers
   ============== */
function isSafeObjectPath(raw: string, teamId: number): boolean {
  if (!raw || typeof raw !== "string") return false;

  let p: string;
  try {
    p = decodeURIComponent(raw);
  } catch {
    return false;
  }

  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;

  const parts = p.split("/");
  if (parts.some((seg) => !seg || seg === ".")) return false;

  const prefix = `teams/${teamId}/`;
  return p.startsWith(prefix);
}

async function signLogoIfNeeded(
  supaUserClient: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  teamId: number,
  logo: string | null
): Promise<string | null> {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo;

  if (!isSafeObjectPath(logo, teamId)) return null;

  const { data, error } = await supaUserClient.storage
    .from(BUCKET)
    .createSignedUrl(logo, 60 * 10);

  if (error) {
    console.error("signLogoIfNeeded error", { error, teamId, logo });
    return null;
  }
  return data?.signedUrl ?? null;
}

/* ======================
   API handlers
   ====================== */

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: "POST,OPTIONS" },
  });
}

/**
 * POST /api/teams/extract-color
 * Body: { teamId: number } OR { file: FormData }
 *
 * Extracts dominant color from team logo (either existing or from uploaded file)
 */
export async function POST(req: Request) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();

    // Auth check
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = Array.isArray(user.app_metadata?.roles)
      ? user.app_metadata.roles
      : [];
    if (!roles.includes("admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";
    let imageBuffer: Buffer;
    let teamId: number | null = null;

    // Handle FormData (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }
    // Handle JSON (teamId)
    else {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }

      teamId = Number(body.teamId);
      if (!Number.isInteger(teamId) || teamId <= 0) {
        return NextResponse.json(
          { error: "Invalid teamId" },
          { status: 400 }
        );
      }

      // Fetch team logo
      const { data: team, error: teamErr } = await supa
        .from("teams")
        .select("id, logo")
        .eq("id", teamId)
        .maybeSingle();

      if (teamErr || !team || !team.logo) {
        return NextResponse.json(
          { error: "Team or logo not found" },
          { status: 404 }
        );
      }

      // Get signed URL if needed
      const logoUrl = await signLogoIfNeeded(supa, team.id, team.logo);
      if (!logoUrl) {
        return NextResponse.json(
          { error: "Failed to access logo" },
          { status: 400 }
        );
      }

      // Fetch image
      imageBuffer = await fetchImage(logoUrl);
    }

    // Extract color
    const color = await extractColorFromImage(imageBuffer);

    // If teamId provided, also update the team record
    if (teamId) {
      const { error: updateErr } = await supa
        .from("teams")
        .update({ colour: color })
        .eq("id", teamId);

      if (updateErr) {
        console.error("Failed to update team colour", updateErr);
        // Still return the color even if update fails
      }
    }

    return NextResponse.json({ colour: color });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/teams/extract-color failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
