// app/seasons/[season]/page.tsx — one season's hub, from stored data only:
// season_recaps (totals, podium, honours, awards, records, months),
// season_team_standings (table), player_season_stats (leaderboards), and the
// season's tournaments/teams rows. No engine runs here.
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { getSeasonRecap } from "@/app/lib/refreshSeasonRecap";
import { getSeasonStandings } from "@/app/lib/refreshStandings";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
import { formatMatchDate } from "@/app/lib/datetime";
import {
  ArchiveShell,
  Crumbs,
  Kicker,
  SectionTitle,
  StatTile,
  StateBlock,
  ArchiveFooter,
  pad2,
} from "../archiveUi";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const { season } = await params;
  const label = decodeURIComponent(season);
  const row = await getSeasonByLabel(label);
  return {
    title: row ? `Σεζόν ${row.display_label}` : "Σεζόν",
    description: row
      ? `Η σεζόν ${row.display_label} του UltraChamp: κατάταξη, τουρνουά, ομάδες, ρεκόρ.`
      : undefined,
  };
}

type LeaderRow = {
  player_id: number;
  matches: number;
  goals: number;
  assists: number;
  mvp_count: number;
  best_gk_count: number;
  player: { id: number; first_name: string | null; last_name: string | null; photo: string | null; deleted_at: string | null } | null;
  team: { id: number; name: string | null; logo: string | null } | null;
};

async function leaders(label: string, key: "goals" | "assists" | "mvp_count" | "best_gk_count") {
  const { data } = await supabaseAdmin
    .from("player_season_stats")
    .select(
      `player_id, matches, goals, assists, mvp_count, best_gk_count,
       player:player_id(id, first_name, last_name, photo, deleted_at),
       team:primary_team_id(id, name, logo)`,
    )
    .eq("season_label", label)
    .gt(key, 0)
    .order(key, { ascending: false })
    .order("matches", { ascending: true })
    .limit(8);
  return ((data ?? []) as unknown as LeaderRow[]).filter((r) => !r.player?.deleted_at).slice(0, 5);
}

const fmt = (iso: string | null | undefined) =>
  iso ? formatMatchDate(iso, { day: "2-digit", month: "short", year: "numeric" }) : "";

export default async function SeasonHubPage({ params }: { params: Promise<{ season: string }> }) {
  const { season: raw } = await params;
  const label = decodeURIComponent(raw);
  const season = await getSeasonByLabel(label);
  if (!season) notFound();
  const isActive = season.status === "active";
  const base = `/seasons/${encodeURIComponent(label)}`;

  const [recapRow, standings, teamsRes, toursRes, scorers, assisters, mvps, gks] = await Promise.all([
    getSeasonRecap(label),
    getSeasonStandings(label),
    supabaseAdmin.from("teams").select("id, name, logo, deleted_at").eq("season_label", label).order("name"),
    supabaseAdmin
      .from("tournaments")
      .select("id, name, logo, status, winner_team_id")
      .eq("season", label)
      .order("id", { ascending: true }),
    leaders(label, "goals"),
    leaders(label, "assists"),
    leaders(label, "mvp_count"),
    leaders(label, "best_gk_count"),
  ]);

  const recap = recapRow?.payload ?? null;
  const teams = ((teamsRes.data ?? []) as { id: number; name: string | null; logo: string | null; deleted_at: string | null }[]).map(
    (t) => ({ ...t, logoUrl: t.logo ? resolveImageUrl(t.logo, ImageType.TEAM) : null }),
  );
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const tournaments = (toursRes.data ?? []) as { id: number; name: string | null; logo: string | null; status: string; winner_team_id: number | null }[];
  const honourByTid = new Map((recap?.honours ?? []).map((h) => [h.tournamentId, h]));

  const tournamentHref = (id: number) => (isActive ? `/tournaments/${id}` : `${base}/tournaments/${id}`);
  const teamHref = (id: number) => (isActive ? `/OMADA/${id}` : `${base}/teams/${id}`);

  const Leader = ({ rows, k, title }: { rows: LeaderRow[]; k: keyof LeaderRow; title: string }) => (
    <div className="border border-[#F3EFE6]/15 bg-[#13131d]/60 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#fb923c]">{title}</div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#F3EFE6]/45">—</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <li key={r.player_id} className="flex items-center gap-3 text-sm">
              <span className="w-5 font-mono text-[#F3EFE6]/40">{pad2(i + 1)}</span>
              <span className="min-w-0 flex-1 truncate">
                {`${r.player?.first_name ?? ""} ${r.player?.last_name ?? ""}`.trim() || `#${r.player_id}`}
                {r.team?.name && <span className="ml-2 text-xs text-[#F3EFE6]/45">{r.team.name}</span>}
              </span>
              <span className="font-mono font-bold">{String(r[k])}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <ArchiveShell>
      <header className="relative border-b-2 border-[#F3EFE6]/20">
        <div className="mx-auto max-w-[1400px] px-6 pt-8 pb-8 md:pt-10">
          <Crumbs items={[{ href: "/seasons", label: "Αρχείο Σεζόν" }, { label: season.display_label }]} />
          <Kicker>{isActive ? "Τρέχουσα σεζόν" : "Αρχείο σεζόν"}</Kicker>
          <h1
            className="mt-2 font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em]"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5.5rem)" }}
          >
            Σεζόν {season.display_label}
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/50">
            {season.label}
            {season.started_on ? ` · ${season.started_on}` : ""}
            {season.ended_on ? ` → ${season.ended_on}` : ""}
            {isActive ? " · σε εξέλιξη" : ""}
          </p>
          {recap && (
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile k="Τουρνουά" v={recap.totals.tournaments} />
              <StatTile k="Ομάδες" v={recap.totals.teams} />
              <StatTile k="Παίκτες" v={recap.totals.players} />
              <StatTile k="Αγώνες" v={recap.totals.matches} />
              <StatTile k="Γκολ" v={recap.totals.goals} />
              <StatTile k="Ασίστ" v={recap.totals.assists} />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-14 px-6 py-10 md:py-14">
        {!recap && standings.length === 0 && (
          <StateBlock
            kicker="Σεζόν"
            title="Δεν υπάρχει snapshot ακόμη"
            body="Η σεζόν δεν έχει αποθηκευμένα στοιχεία — θα εμφανιστούν με το επόμενο snapshot."
          />
        )}

        {recap && recap.podium.length > 0 && (
          <section>
            <SectionTitle kicker="Γενική Κατάταξη" title="Το βάθρο" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {recap.podium.map((p, i) => (
                <Link
                  key={p.teamId}
                  href={teamHref(p.teamId)}
                  className={`flex items-center gap-4 border-2 p-4 transition-colors hover:border-[#fb923c] ${
                    i === 0 ? "border-[#e8c66b]/60 bg-[#e8c66b]/5" : "border-[#F3EFE6]/20 bg-[#13131d]/60"
                  }`}
                >
                  <span className="font-[var(--f-display)] text-4xl font-black italic text-[#e8c66b]">{pad2(i + 1)}</span>
                  {p.logo && (
                    <Image src={p.logo} alt="" width={48} height={48} className="h-12 w-12 object-contain" unoptimized />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/55">
                      {p.points} π. · {p.wins} νίκες{p.titles ? ` · ${p.titles} τίτλοι` : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {standings.length > 0 && (
          <section>
            <div className="flex items-end justify-between gap-4">
              <SectionTitle kicker="Κατάταξη" title="Τελικός πίνακας" />
              <Link
                href={`${base}/katataxi`}
                className="mb-5 border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] transition-colors hover:bg-[#F3EFE6] hover:text-[#0a0a14]"
              >
                Πλήρης κατάταξη →
              </Link>
            </div>
            <div className="overflow-x-auto border border-[#F3EFE6]/15">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[#13131d] font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/55">
                  <tr>
                    {["#", "Ομάδα", "Πόντοι", "Ν", "Ι", "Η", "Γκολ", "Σερί"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.slice(0, 12).map((r) => {
                    const t = teamById.get(r.team_id);
                    return (
                      <tr key={r.team_id} className="border-t border-[#F3EFE6]/10">
                        <td className="px-3 py-2 font-mono">{pad2(r.rank)}</td>
                        <td className="px-3 py-2">
                          <Link href={teamHref(r.team_id)} className="hover:text-[#fb923c]">
                            {t?.name ?? `Ομάδα #${r.team_id}`}
                          </Link>
                          {t?.deleted_at && (
                            <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#F3EFE6]/40">αποχώρησε</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold">{r.points}</td>
                        <td className="px-3 py-2 font-mono">{r.wins}</td>
                        <td className="px-3 py-2 font-mono">{r.draws}</td>
                        <td className="px-3 py-2 font-mono">{r.losses}</td>
                        <td className="px-3 py-2 font-mono">
                          {r.goals_for}:{r.goals_against}
                        </td>
                        <td className="px-3 py-2 font-mono">{r.longest_win_streak}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {standings.length > 12 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/45">
                + {standings.length - 12} ακόμη ομάδες στην πλήρη κατάταξη
              </p>
            )}
          </section>
        )}

        {tournaments.length > 0 && (
          <section>
            <SectionTitle kicker="Τουρνουά" title="Οι διοργανώσεις της σεζόν" />
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tournaments.map((t) => {
                const h = honourByTid.get(t.id);
                const logo = h?.logo ?? (t.logo ? resolveImageUrl(t.logo, ImageType.TOURNAMENT) : null);
                const winner = h?.winnerName ?? (t.winner_team_id ? teamById.get(t.winner_team_id)?.name : null);
                return (
                  <li key={t.id}>
                    <Link
                      href={tournamentHref(t.id)}
                      className="flex items-center gap-4 border border-[#F3EFE6]/15 bg-[#13131d]/60 p-4 transition-colors hover:border-[#fb923c]"
                    >
                      {logo ? (
                        <Image src={logo} alt="" width={44} height={44} className="h-11 w-11 object-contain" unoptimized />
                      ) : (
                        <div className="h-11 w-11 border border-[#F3EFE6]/20" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{(t.name ?? "").trim() || `Τουρνουά #${t.id}`}</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/50">
                          {h?.firstDate ? `${fmt(h.firstDate)} – ${fmt(h.lastDate)}` : t.status}
                          {h?.matches ? ` · ${h.matches} αγ.` : ""}
                        </div>
                        {winner && <div className="mt-0.5 text-xs text-[#e8c66b]">🏆 {winner}</div>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {recap && (
          <section>
            <SectionTitle kicker="Βραβεία" title="Οι κορυφαίοι της σεζόν" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ["Σκόρερ", recap.awards.scorer, "γκολ"],
                  ["Ασίστ", recap.awards.assister, "ασίστ"],
                  ["MVP", recap.awards.mvp, "βραβεία"],
                  ["Τερματοφύλακας", recap.awards.gk, "βραβεία"],
                ] as const
              ).map(([title, a, unit]) => (
                <div key={title} className="border border-[#F3EFE6]/15 bg-[#13131d]/60 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#fb923c]">{title}</div>
                  {a ? (
                    <div className="mt-3 flex items-center gap-3">
                      {a.photo && (
                        <Image src={a.photo} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" unoptimized />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{a.name}</div>
                        <div className="text-xs text-[#F3EFE6]/55">
                          {a.value} {unit}
                          {a.teamName ? ` · ${a.teamName}` : ""}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[#F3EFE6]/45">—</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle kicker="Στατιστικά" title="Λίστες κορυφής" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Leader rows={scorers} k="goals" title="Γκολ" />
            <Leader rows={assisters} k="assists" title="Ασίστ" />
            <Leader rows={mvps} k="mvp_count" title="MVP" />
            <Leader rows={gks} k="best_gk_count" title="Καλύτερος GK" />
          </div>
        </section>

        {recap && (recap.records.highestScoring || recap.records.bestHaul || recap.records.mostTeamWins) && (
          <section>
            <SectionTitle kicker="Ρεκόρ" title="Το βιβλίο της σεζόν" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recap.records.highestScoring && (
                <div className="border border-[#F3EFE6]/15 bg-[#13131d]/60 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#fb923c]">Ο αγώνας με τα περισσότερα γκολ</div>
                  <div className="mt-2 font-[var(--f-display)] text-2xl font-black italic">
                    {recap.records.highestScoring.teamAName} {recap.records.highestScoring.scoreA}–
                    {recap.records.highestScoring.scoreB} {recap.records.highestScoring.teamBName}
                  </div>
                  <div className="text-xs text-[#F3EFE6]/55">
                    {recap.records.highestScoring.tournamentName ?? ""} {fmt(recap.records.highestScoring.date)}
                  </div>
                </div>
              )}
              {recap.records.bestHaul && (
                <div className="border border-[#F3EFE6]/15 bg-[#13131d]/60 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#fb923c]">Τα περισσότερα γκολ σε έναν αγώνα</div>
                  <div className="mt-2 font-[var(--f-display)] text-2xl font-black italic">
                    {recap.records.bestHaul.playerName} · {recap.records.bestHaul.goals} γκολ
                  </div>
                  <div className="text-xs text-[#F3EFE6]/55">
                    {recap.records.bestHaul.teamName ?? ""} {recap.records.bestHaul.scoreA}–{recap.records.bestHaul.scoreB}{" "}
                    {recap.records.bestHaul.opponentName ?? ""} · {fmt(recap.records.bestHaul.date)}
                  </div>
                </div>
              )}
              {recap.records.mostTeamWins && (
                <div className="border border-[#F3EFE6]/15 bg-[#13131d]/60 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#fb923c]">Οι περισσότερες νίκες</div>
                  <div className="mt-2 font-[var(--f-display)] text-2xl font-black italic">
                    {recap.records.mostTeamWins.teamName} · {recap.records.mostTeamWins.wins}
                  </div>
                </div>
              )}
              {recap.records.mostAppearances && (
                <div className="border border-[#F3EFE6]/15 bg-[#13131d]/60 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#fb923c]">Οι περισσότερες συμμετοχές</div>
                  <div className="mt-2 font-[var(--f-display)] text-2xl font-black italic">
                    {recap.records.mostAppearances.playerName} · {recap.records.mostAppearances.matches}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {recap && recap.months.length > 0 && (
          <section>
            <SectionTitle kicker="Ρυθμός" title="Αγώνες ανά μήνα" />
            <div className="flex items-end gap-2 overflow-x-auto border border-[#F3EFE6]/15 bg-[#13131d]/60 p-4">
              {(() => {
                const max = Math.max(...recap.months.map((m) => m.matches), 1);
                return recap.months.map((m) => (
                  <div key={m.month} className="flex min-w-[44px] flex-col items-center gap-1">
                    <span className="font-mono text-[10px] text-[#F3EFE6]/70">{m.matches}</span>
                    <div className="w-6 bg-[#fb923c]" style={{ height: `${Math.max(4, (m.matches / max) * 96)}px` }} />
                    <span className="font-mono text-[9px] uppercase text-[#F3EFE6]/45">{m.month.slice(2).replace("-", "/")}</span>
                  </div>
                ));
              })()}
            </div>
          </section>
        )}

        {teams.length > 0 && (
          <section>
            <SectionTitle kicker="Ομάδες" title={`Οι ομάδες της σεζόν (${teams.length})`} />
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {teams.map((t) => (
                <li key={t.id}>
                  <Link
                    href={teamHref(t.id)}
                    className="flex items-center gap-2 border border-[#F3EFE6]/15 bg-[#13131d]/60 p-2.5 text-sm transition-colors hover:border-[#fb923c]"
                  >
                    {t.logoUrl ? (
                      <Image src={t.logoUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" unoptimized />
                    ) : (
                      <div className="h-7 w-7 border border-[#F3EFE6]/20" />
                    )}
                    <span className="min-w-0 truncate">{t.name ?? `#${t.id}`}</span>
                    {t.deleted_at && <span className="ml-auto font-mono text-[9px] text-[#F3EFE6]/40">✕</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <ArchiveFooter label={`Σεζόν ${season.display_label} · ${season.label}`} />
    </ArchiveShell>
  );
}
