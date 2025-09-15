// components/tournaments/CompletedList.tsx
import Link from "next/link";

export type CompletedTournamentItem = {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  season?: string | null;
  winner_team_id?: number | null;
};

type WinnersById = Record<number, { name: string }>;

export default function CompletedList({
  items,
  winnersById,
  showSeason = true,
}: {
  items: CompletedTournamentItem[];
  winnersById?: WinnersById; // optional map to resolve winner names
  showSeason?: boolean;
}) {
  const winnerName = (id?: number | null) =>
    (id && winnersById?.[id]?.name) || (id ? `Team #${id}` : "—");

  return (
    <ul className="space-y-3">
      {(items ?? []).map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
        >
          <div className="min-w-0">
            <div className="font-medium truncate">
              {t.name}
              {showSeason && t.season ? (
                <span className="text-white/60 text-sm"> • {t.season}</span>
              ) : null}
            </div>
            {typeof t.winner_team_id !== "undefined" && (
              <div className="text-xs text-white/70 mt-0.5">
                Winner: <span className="text-white/90">{winnerName(t.winner_team_id)}</span>
              </div>
            )}
          </div>

          <Link
            href={`/tournoua/${t.slug}`}
            className="text-sm underline opacity-80 hover:opacity-100 shrink-0"
          >
            Περισσότερα
          </Link>
        </li>
      ))}

      {(!items || items.length === 0) && (
        <li className="text-white/60">Καμία ολοκληρωμένη διοργάνωση.</li>
      )}
    </ul>
  );
}
