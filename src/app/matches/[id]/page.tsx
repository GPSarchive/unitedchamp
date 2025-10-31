// src/app/matches/[id]/page.tsx
export const revalidate = 0;

import TeamBadge from "./TeamBadge";
import ParticipantsStats from "./MatchStats";
import StatsEditor from "./StatsEditor";
import { saveAllStatsAction } from "./actions";
import {
  fetchMatch,
  fetchPlayersForTeam,
  fetchMatchStatsMap,
  fetchParticipantsMap,
} from "./queries";
import { parseId, extractYouTubeId, formatStatus } from "./utils";
import { notFound } from "next/navigation";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import { createSupabaseRouteClient } from "@/app/lib/supabase/Server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import VantaBg from "@/app/lib/VantaBg";
import styles from "./triumph.module.css";
import ShinyText from "./ShinyText";
import Image from "next/image";
// ⬇️ NEW: import the client LaurelWreath


/* ─────────────────────────────────────────────────────────
   Προ-υπογραφή (signed URLs) για φωτογραφίες παικτών
   ───────────────────────────────────────────────────────── */
const PLAYER_BUCKET = "GPSarchive's Project";
const SIGN_TTL_SECONDS = 60 * 5;

/** Type guard: είναι storage key (σχετική διαδρομή) κι όχι πλήρες URL */
function isStorageKey(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (/^(https?:)?\/\//i.test(v)) return false; // absolute URL
  if (v.startsWith("/")) return false; // absolute path
  if (v.startsWith("data:")) return false; // data URL
  return v.trim().length > 0;
}

/** Μαζικά signed URLs για keys */
async function bulkSign(keys: string[]) {
  const unique = Array.from(new Set(keys));
  if (unique.length === 0) return new Map<string, string>();
  const { data, error } = await supabaseAdmin.storage
    .from(PLAYER_BUCKET)
    .createSignedUrls(unique, SIGN_TTL_SECONDS);
  const map = new Map<string, string>();
  if (!error && data) {
    unique.forEach((k, i) => {
      const u = data[i]?.signedUrl;
      if (u) map.set(k, u);
    });
  }
  return map;
}

/** Εφαρμογή signed URLs και εξαναγκασμός photo => string */
function applySignedUrls(
  list: PlayerAssociation[],
  signedMap: Map<string, string>
): PlayerAssociation[] {
  return list.map((a) => {
    const raw = (a.player as any).photo as unknown;
    const photoSigned = isStorageKey(raw) ? signedMap.get(raw) : undefined;
    const normalizedPhoto = (photoSigned ?? (typeof raw === "string" ? raw : "")) as string;
    return { ...a, player: { ...a.player, photo: normalizedPhoto } };
  });
}

function errMsg(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as any;
  return anyE?.message || anyE?.error?.message || JSON.stringify(anyE);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ video?: string }>;
}) {
  // --- Έλεγχος admin (server-side) ---
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = Array.isArray(user?.app_metadata?.roles)
    ? (user!.app_metadata!.roles as string[]).includes("admin")
    : false;

  const { id: idStr } = await params;
  const { video } = await searchParams;
  const id = parseId(idStr) as Id | null;
  if (!id) return notFound();

  // 1) Αγώνας
  const match = await fetchMatch(id);
  if (!match) return notFound();

  // ✅ SIMPLIFIED: Tournament logo now properly typed after fixing queries.ts
  const tournamentLogoRaw = match.tournament?.logo ?? null;

  // 2) Παράλληλα: παίκτες/στατς/συμμετοχές
  const [aRes, bRes, statsRes, partsRes] = await Promise.allSettled([
    fetchPlayersForTeam(match.team_a.id),
    fetchPlayersForTeam(match.team_b.id),
    fetchMatchStatsMap(match.id),
    fetchParticipantsMap(match.id),
  ]);

  let teamAPlayers: PlayerAssociation[] =
    aRes.status === "fulfilled" ? (aRes.value as PlayerAssociation[]) : [];
  let teamBPlayers: PlayerAssociation[] =
    bRes.status === "fulfilled" ? (bRes.value as PlayerAssociation[]) : [];
  const existingStats =
    statsRes.status === "fulfilled" ? statsRes.value : new Map();
  const participants =
    partsRes.status === "fulfilled" ? partsRes.value : new Map();

  const dataLoadErrors: string[] = [];
  if (aRes.status === "rejected")
    dataLoadErrors.push(`Team A players: ${errMsg(aRes.reason)}`);
  if (bRes.status === "rejected")
    dataLoadErrors.push(`Team B players: ${errMsg(bRes.reason)}`);
  if (statsRes.status === "rejected")
    dataLoadErrors.push(`Match stats: ${errMsg(statsRes.reason)}`);
  if (partsRes.status === "rejected")
    dataLoadErrors.push(`Participants: ${errMsg(partsRes.reason)}`);

  // 3) Υπογραφή φωτογραφιών (αν είναι storage keys)
  let tournamentLogo: string | null = null;

  try {
    const photoKeys: string[] = [
      ...teamAPlayers.map((a) => a.player.photo).filter(isStorageKey),
      ...teamBPlayers.map((a) => a.player.photo).filter(isStorageKey),
      ...(isStorageKey(tournamentLogoRaw) ? [tournamentLogoRaw] : []),
    ];
    const signedMap = await bulkSign(photoKeys);
    teamAPlayers = applySignedUrls(teamAPlayers, signedMap);
    teamBPlayers = applySignedUrls(teamBPlayers, signedMap);

    // κανονικοποίηση tournament logo σε string URL
    if (isStorageKey(tournamentLogoRaw)) {
      tournamentLogo = signedMap.get(tournamentLogoRaw) ?? null;
    } else if (typeof tournamentLogoRaw === "string") {
      tournamentLogo = tournamentLogoRaw;
    }
  } catch (e) {
    dataLoadErrors.push(`Photo signing: ${errMsg(e)}`);
  }

  const videoId = extractYouTubeId(video ?? null);

  const dateLabel = match.match_date
    ? new Date(match.match_date).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "TBD";

  const aIsWinner =
    match.winner_team_id && match.winner_team_id === match.team_a.id;
  const bIsWinner =
    match.winner_team_id && match.winner_team_id === match.team_b.id;

  // Στατική περιστροφή στεφανιού (όχι ολόκληρο SVG animation)
  const LAUREL_ROTATE = 95;

  return (
    <div className="relative min-h-dvh overflow-x-visible">
      {/* Φόντο Vanta */}
      <VantaBg className="absolute inset-0 -z-10" mode="balanced" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />

      {/* ───────────── Triumphant Cup + Laurel (Gold) ───────────── */}
      <div className="container mx-auto max-w-6xl px-4 pt-6">
        <div className="flex justify-center">
          <div className={"pointer-events-none select-none"}>
            {/* TOURNAMENT LOGO */}
            {tournamentLogo ? (
              <div className="mb-3 flex justify-center">
                <Image
                  src={tournamentLogo}
                  alt={match.tournament?.name ?? "Tournament logo"}
                  width={160}
                  height={160}
                  className="h-14 w-auto rounded-md bg-white/5 p-2 ring-1 ring-white/10"
                  priority
                />
              </div>
            ) : null}


            {/* Tournament Title (shiny) - ✅ SIMPLIFIED: No more type casting */}
            <div className="mt-4 flex justify-center">
              <ShinyText
                text={
                  match.tournament?.name ??
                  `${match.team_a.name} vs ${match.team_b.name}`
                }
                speed={3}
                className="
                text-center
                text-3xl md:text-5xl
                font-extrabold leading-tight tracking-tight
                drop-shadow-[0_1px_0_rgba(0,0,0,.25)]
              "
              />
            </div>
          </div>
        </div>
      </div>

      {/* ───────────── Πίνακας αγώνα + Συμμετέχοντες ───────────── */}
      <div className="container mx-auto max-w-6xl space-y-8 px-4 py-6">
        {dataLoadErrors.length > 0 && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-amber-200 text-sm">
            <p className="font-medium">Some data failed to load:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {dataLoadErrors.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6 shadow-sm backdrop-blur text-white">
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-8">
            <TeamBadge team={match.team_a} highlight={!!aIsWinner} />

            <div className="relative mx-auto min-w-[220px] text-center">
              <div className="text-xs uppercase tracking-wide text-white/70">
                {formatStatus(match.status)}
              </div>
              <div className="text-4xl font-bold leading-none text-white">
                {match.team_a_score}
                <span className="text-white/60">-</span>
                {match.team_b_score}
              </div>
              <div className="text-sm text-white/70">{dateLabel}</div>
              {match.referee && (
                <div className="mt-1 text-xs text-white/75">
                  Διαιτητής: <span className="font-medium">{match.referee}</span>
                </div>
              )}
            </div>

            <TeamBadge team={match.team_b} className="text-right" highlight={!!bIsWinner} />
          </div>

          <div className="my-6 h-px w-full bg-white/10" />

          <ParticipantsStats
            renderAs="embedded"
            labels={{ left: "Home", right: "Away" }}
            teamA={{ id: match.team_a.id, name: match.team_a.name }}
            teamB={{ id: match.team_b.id, name: match.team_b.name }}
            associationsA={teamAPlayers}
            associationsB={teamBPlayers}
            statsByPlayer={existingStats}
            participants={participants}
          />
        </section>

        {/* Βίντεο αγώνα */}
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Match Video</h2>
          {videoId ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <p>
                No video provided. Append <code>?video=YOUTUBE_ID_OR_URL</code> to the page URL.
              </p>
            </div>
          )}
        </section>

        {/* Επεξεργασία (admin) */}
        {isAdmin ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Admin: Match Player Stats</h2>
            <p className="mb-4 text-xs text-gray-500">
              Ενεργοποίησε <strong>Συμμετοχή</strong>, δήλωσε θέση/αρχηγό/GK και συμπλήρωσε
              στατιστικά. Πάτησε <strong>Save all</strong> για αποθήκευση.
            </p>

            <form id="stats-form" action={saveAllStatsAction}>
              <input type="hidden" name="match_id" value={String(match.id)} />
              <div className="grid grid-cols-1 gap-6">
                <StatsEditor
                  teamId={match.team_a.id}
                  teamName={match.team_a.name}
                  associations={teamAPlayers}
                  existing={existingStats}
                  participants={participants}
                />
                <StatsEditor
                  teamId={match.team_b.id}
                  teamName={match.team_b.name}
                  associations={teamBPlayers}
                  existing={existingStats}
                  participants={participants}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Save all
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}