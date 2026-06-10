// app/api/teams/[id]/restore/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { ensureSameOrigin } from "@/app/lib/same-origin";

const BUCKET = "GPSarchive's Project";
type Ctx = { params: Promise<{ id: string }> };

function parsePositiveInt(s: string): number | null {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isSafeObjectPath(raw: string, teamId: number): boolean {
  if (!raw || typeof raw !== "string") return false;
  let p: string;
  try { p = decodeURIComponent(raw); } catch { return false; }
  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;
  const parts = p.split("/");
  if (parts.some(seg => !seg || seg === ".")) return false;
  const prefix = `teams/${teamId}/`;
  return p.startsWith(prefix);
}

async function signLogoIfNeededSafe(
  supaUserClient: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  teamId: number,
  logo: string | null
) {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo;
  if (!isSafeObjectPath(logo, teamId)) return null;
  const { data, error } = await supaUserClient.storage.from(BUCKET).createSignedUrl(logo, 60 * 10);
  if (error) {
    console.error("signLogoIfNeededSafe error", { error, teamId, logo });
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "POST,OPTIONS,HEAD" } });
}

/* ==========================================
   POST /api/teams/[id]/restore (admin)
   ========================================== */
export async function POST(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idParam } = await ctx.params; // Next 15: params is a Promise
    const id = parsePositiveInt(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { data, error } = await supa
      .from("teams")
      .update({ deleted_at: null })
      .eq("id", id)
      .not("deleted_at", "is", null) // only restore if currently deleted
      .select("id, name, logo, created_at, deleted_at")
      .maybeSingle();

    if (error) {
      console.error("POST restore error", error);
      return NextResponse.json({ error: "Restore failed" }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      team: { ...data, logo: await signLogoIfNeededSafe(supa, data.id, data.logo) },
      restored: true
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /teams/[id]/restore failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
