// app/api/public/player-profile/[id]/route.ts
// One player's profile, for the overlay that opens when a player card is
// clicked on a page other than the players page (the match page…). The players
// page ships the whole season with the list; other pages ask for one player
// here, on click.
//
// Every player card opens a profile, so every real player has one: the
// current squads exactly as on the players page, everyone else (left
// mid-season, archived, seen on an older match) centred on their last season
// — see loadAnyProfile. Read with the service role from cached data, so a
// warm request costs no database work. Unknown and dummy players are a 404.
// Every request passes the rate limiter in proxy.ts.
//
// Used by the preview pages for now (/preview/matches-v3); it moves with them
// when the new players page is promoted.
import { NextResponse } from "next/server";
import { loadAnyProfile } from "@/app/preview/paiktes-v3/profileLoader";

type Ctx = { params: Promise<{ id: string }> };

/** Same freshness as the players page (revalidate = 300). */
const CACHE = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET(_req: Request, ctx: Ctx) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const profile = await loadAnyProfile(id);
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": CACHE } });
  }
  return NextResponse.json(profile, { headers: { "Cache-Control": CACHE } });
}
